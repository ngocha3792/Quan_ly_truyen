import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-support-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './support-page.component.html',
  styleUrls: ['./support-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportPageComponent {}
