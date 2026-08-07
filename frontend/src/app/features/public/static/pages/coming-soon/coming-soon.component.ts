import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonComponent {
  title = input<string>('Tính năng đang phát triển');
  description = input<string>(
    'Chúng tôi đang nỗ lực hoàn thiện tính năng này để mang lại trải nghiệm tốt nhất cho bạn.'
  );
  authActionMode = input<string>();
}
