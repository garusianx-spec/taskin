import { Module } from '@nestjs/common';
import { AuthService } from './auth/auth.service.js';
import { CsrfGuard, JwtAuthGuard, StepUpGuard } from './auth/guards.js';
import { OtpService } from './auth/otp.service.js';
import { PasswordService } from './auth/password.service.js';
import { RevocationService } from './auth/revocation.service.js';
import { SessionService } from './auth/session.service.js';
import { TokenService } from './auth/token.service.js';
import { AbilityFactory } from './rbac/ability.js';
import { PoliciesGuard, WorkspaceMemberGuard } from './rbac/guards.js';
import { MembershipService } from './rbac/membership.service.js';
import { RolesService } from './rbac/roles.service.js';
import { UsersService } from './users/users.service.js';
import { DepartmentsService } from './workspaces/departments.service.js';
import { IconsService } from './workspaces/icons.service.js';
import { InvitationsService } from './workspaces/invitations.service.js';
import { MembersService } from './workspaces/members.service.js';
import { WorkspacesService } from './workspaces/workspaces.service.js';

const services = [
  // auth
  TokenService,
  RevocationService,
  SessionService,
  OtpService,
  PasswordService,
  AuthService,
  JwtAuthGuard,
  StepUpGuard,
  CsrfGuard,
  // users
  UsersService,
  // rbac
  AbilityFactory,
  MembershipService,
  RolesService,
  WorkspaceMemberGuard,
  PoliciesGuard,
  // workspaces
  IconsService,
  WorkspacesService,
  MembersService,
  DepartmentsService,
  InvitationsService,
];

/**
 * The bounded contexts' services (auth, users, rbac, workspaces). No controllers: the HTTP API
 * and the worker each import this and add their own entry points, so a worker can never expose
 * a route without the HTTP guards in front of it.
 */
@Module({ providers: services, exports: services })
export class DomainModule {}
