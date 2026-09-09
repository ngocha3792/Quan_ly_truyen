import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaymentProviderConnection, PaymentProviderField } from '../../domain/admin-payment.models';

@Component({
  selector: 'app-provider-setup-fields',
  imports: [FormsModule],
  templateUrl: './provider-setup-fields.component.html',
  styleUrl: './provider-setup-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderSetupFieldsComponent {
  readonly fields = input.required<readonly PaymentProviderField[]>();
  readonly config = input.required<Record<string, string>>();
  readonly credentials = input.required<Record<string, string>>();
  readonly saved = input<PaymentProviderConnection | null>(null);
  readonly configChange = output<Record<string, string>>();
  readonly credentialsChange = output<Record<string, string>>();

  protected update(field: PaymentProviderField, value: string): void {
    if (field.secret) this.credentialsChange.emit({ ...this.credentials(), [field.name]: value });
    else this.configChange.emit({ ...this.config(), [field.name]: value });
  }

  protected missing(field: PaymentProviderField): boolean {
    return (
      this.saved()?.missingConfigurationFields.some(
        (name) => name === field.name || name.endsWith(`.${field.name}`),
      ) ?? false
    );
  }
}
