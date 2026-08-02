import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-emissor-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './emissor-shell.html',
  styleUrl: './emissor-shell.css',
})
export class EmissorShellComponent {
  protected readonly auth = inject(AuthService);
}
