import { NextRequest, NextResponse } from "next/server";
import type {
  BackPanelMountingMode,
  CncMachineFormatId,
  ConnectorSystemType,
  SaasPlanId,
  SaasRoleId,
} from "@birim/core";
import {
  TenantSecurityError,
  assertTenantPermissionAndEntitlement,
  resolveTenantRequestContext,
  signTenantSessionToken,
} from "../../../../lib/tenant-auth-guard";
import { modulPostgresRepo } from "../../../../lib/modul-postgres-repository";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: "login" | "register_org" | "create_invite" | "accept_invite" | "logout";
      email?: string;
      password?: string;
      fullName?: string;
      tenantId?: string;
      companyDisplayName?: string;
      companyLegalName?: string;
      slug?: string;
      planId?: SaasPlanId;
      currency?: "EUR" | "TRY";
      carcassThicknessMm?: number;
      backPanelMounting?: BackPanelMountingMode;
      connectorSystem?: ConnectorSystemType;
      primaryCncFormat?: CncMachineFormatId;
      invitedEmail?: string;
      invitedRole?: SaasRoleId;
      inviteToken?: string;
    };

    if (body.action === "login") {
      const auth = modulPostgresRepo.authenticateUser(body.email || "", body.password || "");
      const chosenMembership =
        (body.tenantId
          ? auth.memberships.find((m) => m.tenantId === body.tenantId)
          : auth.memberships[0]) || auth.memberships[0];

      if (!chosenMembership) {
        throw new TenantSecurityError("NO_ACTIVE_MEMBERSHIP", "Kullanıcının aktif bir organizasyon üyeliği bulunamadı.", 403);
      }

      const effectiveRole: SaasRoleId = auth.user.isPlatformSuperAdmin
        ? "platform_admin"
        : chosenMembership.role;

      const sessionToken = signTenantSessionToken({
        tenantId: chosenMembership.tenantId,
        userId: auth.user.id,
        role: effectiveRole,
        branchId: chosenMembership.branchCode || null,
      });

      const res = NextResponse.json({
        ok: true,
        user: auth.user,
        activeMembership: chosenMembership,
        memberships: auth.memberships,
        sessionToken,
      });
      res.cookies?.set?.("modul_session", sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 8 * 3600,
      });
      return res;
    }

    if (body.action === "register_org") {
      const created = await modulPostgresRepo.registerOrganizationAndOwner({
        companyDisplayName: body.companyDisplayName || "Yeni Mobilya Stüdyosu",
        companyLegalName: body.companyLegalName || body.companyDisplayName || "Yeni Mobilya A.Ş.",
        slug: body.slug || `firma-${Date.now()}`,
        ownerFullName: body.fullName || "Firma Yöneticisi",
        ownerEmail: body.email || `kurucu@${Date.now()}.modul.studio`,
        password: body.password || "Modul2026!",
        planId: body.planId || "business",
        currency: body.currency || "TRY",
        carcassThicknessMm: body.carcassThicknessMm || 18,
        backPanelMounting: body.backPanelMounting || "grooved_8mm",
        connectorSystem: body.connectorSystem || "minifix_dowel",
        primaryCncFormat: body.primaryCncFormat || "homag_mpr",
      });

      const sessionToken = signTenantSessionToken({
        tenantId: created.tenant.tenantId,
        userId: created.owner.id,
        role: "org_owner",
      });

      return NextResponse.json(
        {
          ok: true,
          tenant: created.tenant,
          owner: created.owner,
          membership: created.membership,
          sessionToken,
        },
        { status: 201 }
      );
    }

    if (body.action === "create_invite") {
      const ctx = resolveTenantRequestContext(req, { tenantId: body.tenantId });
      assertTenantPermissionAndEntitlement(ctx, "tenant:manage_members");
      const invite = modulPostgresRepo.createMemberInvitation({
        tenantId: ctx.tenantId,
        invitedEmail: body.invitedEmail || "",
        role: body.invitedRole || "designer",
        invitedByUserId: ctx.userId,
      });
      return NextResponse.json({ ok: true, invite }, { status: 201 });
    }

    if (body.action === "accept_invite") {
      const membership = modulPostgresRepo.acceptMemberInvitation({
        inviteToken: body.inviteToken || "",
        fullName: body.fullName || "Ekip Üyesi",
        password: body.password || "Modul2026!",
      });
      const sessionToken = signTenantSessionToken({
        tenantId: membership.tenantId,
        userId: membership.userId,
        role: membership.role,
      });
      return NextResponse.json({ ok: true, membership, sessionToken });
    }

    if (body.action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies?.delete?.("modul_session");
      return res;
    }

    return NextResponse.json({ ok: false, error: "Geçersiz auth işlemi." }, { status: 400 });
  } catch (err) {
    if (err instanceof TenantSecurityError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Kimlik doğrulama hatası." },
      { status: 500 }
    );
  }
}
