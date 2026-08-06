import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    OnDestroy,
    output,
    signal,
} from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { UserAvatarComponent } from '../../../../../shared/components/user-avatar/user-avatar.component';

@Component({
    selector: 'app-profile-avatar-editor',
    standalone: true,
    imports: [
        IconComponent,
        UserAvatarComponent,
    ],
    changeDetection:
        ChangeDetectionStrategy.OnPush,
    template: `
    <div class="avatar-editor">
      <div class="avatar-preview">
        @if (previewUrl()) {
          <img
            [src]="previewUrl()"
            [alt]="displayName()"
          />
        } @else {
          <app-user-avatar
            [name]="displayName()"
            [url]="avatarUrl()"
            [size]="96"
          />
        }

        <label
          class="camera-button"
          aria-label="Chọn ảnh đại diện"
        >
          <app-icon
            name="camera"
            [size]="16"
          />

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            (change)="selectFile($event)"
          />
        </label>
      </div>

      <div class="avatar-copy">
        <h2>{{ displayName() }}</h2>

        <div class="badges">
          <span class="member-badge">
            <app-icon
              name="sparkles"
              [size]="13"
            />

            {{ membershipLabel() }}
          </span>

          <span
            class="verified-badge"
            [class.unverified]="
              !emailVerified()
            "
          >
            <app-icon
              [name]="
                emailVerified()
                  ? 'check'
                  : 'mail'
              "
              [size]="13"
            />

            {{
              emailVerified()
                ? 'Email đã xác minh'
                : 'Email chưa xác minh'
            }}
          </span>
        </div>
      </div>

      <label class="change-avatar-button">
        <app-icon
          name="camera"
          [size]="16"
        />

        Đổi ảnh

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          (change)="selectFile($event)"
        />
      </label>
    </div>
  `,
    styles: `
    .avatar-editor {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 24px;
    }

    .avatar-preview {
      position: relative;
      width: 96px;
      height: 96px;
    }

    .avatar-preview > img {
      width: 96px;
      height: 96px;
      object-fit: cover;
      border: 5px solid rgba(139, 92, 246, .16);
      border-radius: 50%;
      box-shadow: 0 14px 32px rgba(80, 35, 172, .28);
    }

    .camera-button {
      position: absolute;
      right: -3px;
      bottom: 2px;
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border: 3px solid #0f1628;
      border-radius: 50%;
      color: #f5f3fa;
      cursor: pointer;
      background: #293044;
    }

    input[type='file'] {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    .avatar-copy {
      min-width: 0;
    }

    h2 {
      margin: 0 0 12px;
      color: #f8fafc;
      font-size: clamp(24px, 2.4vw, 30px);
      font-weight: 700;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .member-badge,
    .verified-badge {
      padding: 7px 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 7px;
      font-size: 12.5px;
      font-weight: 650;
    }

    .member-badge {
      color: #c084fc;
      background: rgba(129, 67, 214, .2);
    }

    .verified-badge {
      color: #4ade80;
      background: rgba(34, 197, 94, .16);
    }

    .verified-badge.unverified {
      color: #fbbf24;
      background: rgba(245, 158, 11, .16);
    }

    .change-avatar-button {
      min-height: 42px;
      padding: 0 16px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid rgba(150, 161, 192, .3);
      border-radius: 7px;
      color: #e4e1eb;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
      background: rgba(255, 255, 255, .025);
    }

    .change-avatar-button:hover {
      border-color: rgba(176, 118, 255, .5);
      color: #c58fff;
    }

    @media (max-width: 660px) {
      .avatar-editor {
        grid-template-columns: auto 1fr;
      }

      .change-avatar-button {
        grid-column: 1 / -1;
        width: max-content;
      }
    }
  `,
})
export class ProfileAvatarEditorComponent
    implements OnDestroy {
    readonly displayName =
        input.required<string>();

    readonly membershipLabel =
        input('Thành viên');

    readonly avatarUrl =
        input<string | null>(null);

    readonly emailVerified =
        input(false);

    readonly fileSelected =
        output<File | null>();

    private readonly selectedFile =
        signal<File | null>(null);

    private objectUrl: string | null =
        null;

    readonly previewUrl = computed(() => {
        const file = this.selectedFile();

        if (!file) {
            return null;
        }

        if (this.objectUrl) {
            URL.revokeObjectURL(
                this.objectUrl,
            );
        }

        this.objectUrl =
            URL.createObjectURL(file);

        return this.objectUrl;
    });

    protected selectFile(
        event: Event,
    ): void {
        const inputElement =
            event.target as HTMLInputElement;

        const file =
            inputElement.files?.[0] ?? null;

        if (!file) {
            return;
        }

        const allowedTypes = new Set([
            'image/jpeg',
            'image/png',
            'image/webp',
        ]);

        if (!allowedTypes.has(file.type)) {
            inputElement.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            inputElement.value = '';
            return;
        }

        this.selectedFile.set(file);
        this.fileSelected.emit(file);

        inputElement.value = '';
    }

    ngOnDestroy(): void {
        if (this.objectUrl) {
            URL.revokeObjectURL(
                this.objectUrl,
            );
        }
    }
}