import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(60)
  usuario!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  senha!: string;
}
