import { registerAs } from '@nestjs/config';

/**
 * Configuração de autenticação.
 *
 * ⚠️ IMPORTANTE — MODELO DE CREDENCIAIS ATUAL É MOCK:
 * `MAGISTRADO_USUARIO` / `MAGISTRADO_SENHA_HASH` / `MAGISTRADO_HASH` simulam
 * um único magistrado autenticado por usuário+senha, para fins de demonstração
 * acadêmica. Em produção isso DEVE ser substituído por autenticação via
 * certificado digital ICP-Brasil (ex: validação de assinatura PAdES/CMS do
 * PDF, com extração do hash do certificado do próprio signatário), nunca por
 * usuário/senha estático compartilhado.
 *
 * `JWT_SECRET` nunca deve usar o valor padrão fora de ambiente local.
 */
export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-NAO-USAR-EM-PRODUCAO',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',

  // Credenciais mock de um único magistrado (ver aviso acima).
  magistradoUsuario: process.env.MAGISTRADO_USUARIO ?? 'magistrado',
  // bcrypt hash da senha 'tjpB2026' — SOMENTE para ambiente de desenvolvimento local.
  magistradoSenhaHash:
    process.env.MAGISTRADO_SENHA_HASH ??
    '$2b$10$eH9wGm/0mBwynK6puIL0ienBUYMzazeiXn52XeQwTeEyiA5oEoFVe',
  magistradoHash:
    process.env.MAGISTRADO_HASH ??
    '0x1f3d89c259932131898eba5c76186e6b44d0e4a152456d70ce3063ad56c2094b',
}));
