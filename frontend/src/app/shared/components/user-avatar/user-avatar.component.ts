import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';

@Component({
    selector: 'app-user-avatar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      class="avatar"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="size() * 0.42"
    >
      @if (url()) {
        <img
          [src]="url()"
          [alt]="name()"
        />
      } @else {
        <span>{{ initial() }}</span>
      }
    </div>
  `,
    styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
    }

    .avatar {
      position: relative;
      display: grid;
      place-items: center;
      overflow: hidden;
      border: 5px solid rgba(139, 92, 246, 0.13);
      border-radius: 50%;
      color: #fff;
      font-weight: 850;
      line-height: 1;
      background:
        radial-gradient(
          circle at 30% 20%,
          rgba(255, 255, 255, 0.2),
          transparent 35%
        ),
        linear-gradient(
          145deg,
          #985df2,
          #6130d9
        );
      box-shadow:
        0 14px 30px rgba(76, 29, 149, 0.3),
        inset 0 0 0 1px rgba(255, 255, 255, 0.15);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class UserAvatarComponent {
    readonly name = input.required<string>();
    readonly url = input<string | null>(null);
    readonly size = input(72);

    readonly initial = computed(() => {
        const normalizedName = this.name().trim();

        return normalizedName
            ? normalizedName.charAt(0).toUpperCase()
            : '?';
    });
}