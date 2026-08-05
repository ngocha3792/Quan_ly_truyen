import { AuthIconName } from '../components/auth-icon/auth-icon.component';

export interface AuthBenefit {
  readonly title: string;
  readonly description: string;
  readonly icon: AuthIconName;
  readonly tone: string;
}
