import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-avatar.component.html',
  styleUrl: './user-avatar.component.scss',
})
export class UserAvatarComponent {
  readonly name = input.required<string>();
  readonly url = input<string | null>(null);
  readonly size = input(72);

  readonly initial = computed(() => {
    const normalizedName = this.name().trim();

    return normalizedName ? normalizedName.charAt(0).toUpperCase() : '?';
  });
}
