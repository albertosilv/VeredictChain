export { AuthModule } from './auth.module';
export { AuthService } from './auth.service';
export type { JwtPayload, LoginResultado } from './auth.service';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { CurrentUser } from './decorators/current-user.decorator';
export type { RequestUser } from './strategies/jwt.strategy';
