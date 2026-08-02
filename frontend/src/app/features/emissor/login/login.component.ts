import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = signal('');
  readonly senha = signal('');
  readonly erro = signal(false);

  onSubmit(): void {
    const ok = this.auth.login(this.usuario(), this.senha());
    if (ok) {
      this.router.navigate(['/emissor']);
    } else {
      this.erro.set(true);
    }
  }
}
