import { MODULE_METADATA } from '@nestjs/common/constants';

import { AppModule } from '@/app.module';
import { AuthorApplicationsModule } from '@/modules/author-applications';
import { UsersModule } from '@/modules/users';

import { AuthAccountSecurityModule } from './auth-account-security.module';
import { AuthAuthorizationModule } from './auth-authorization.module';
import { AuthCoreModule } from './auth-core.module';
import { AuthCredentialsModule } from './auth-credentials.module';
import { AuthModule } from './auth.module';
import { AuthOAuthModule } from './auth-oauth.module';
import { AuthSessionsModule } from './auth-sessions.module';

function importsOf(moduleType: object): readonly unknown[] {
  return (
    (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleType) as
      readonly unknown[] | undefined) ?? []
  );
}

function exportsOf(moduleType: object): readonly unknown[] {
  return (
    (Reflect.getMetadata(MODULE_METADATA.EXPORTS, moduleType) as
      readonly unknown[] | undefined) ?? []
  );
}

describe('application module wiring', () => {
  it('keeps the feature modules connected to AppModule', () => {
    expect(importsOf(AppModule)).toEqual(
      expect.arrayContaining([
        AuthModule,
        AuthorApplicationsModule,
        UsersModule,
      ]),
    );
  });

  it('composes every auth feature submodule through AuthModule', () => {
    expect(importsOf(AuthModule)).toEqual(
      expect.arrayContaining([
        AuthAuthorizationModule,
        AuthCoreModule,
        AuthCredentialsModule,
        AuthSessionsModule,
        AuthAccountSecurityModule,
        AuthOAuthModule,
      ]),
    );
    expect(exportsOf(AuthModule)).toEqual(
      expect.arrayContaining([AuthCoreModule, AuthAuthorizationModule]),
    );
  });

  it('keeps business modules coupled only to the narrow auth integration', () => {
    for (const featureModule of [UsersModule, AuthorApplicationsModule]) {
      const imports = importsOf(featureModule);

      expect(imports).toContain(AuthAuthorizationModule);
      expect(imports).not.toContain(AuthModule);
      expect(imports).not.toContain(AuthCoreModule);
    }
  });
});
