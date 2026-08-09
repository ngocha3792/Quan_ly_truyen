import { ChangeDetectionStrategy, Component, effect, inject, OnInit } from '@angular/core';

import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { SecurityQuestionsStore } from '../../data-access/security-questions.store';

import { SecurityFeatureShellComponent } from '../../ui/security-feature-shell/security-feature-shell.component';
import { SecurityPanelComponent } from '../../ui/security-panel/security-panel.component';

type QuestionAnswerForm = FormGroup<{
  questionId: FormControl<string>;
  answer: FormControl<string>;
}>;

@Component({
  selector: 'app-security-questions-page',

  standalone: true,

  imports: [ReactiveFormsModule, SecurityFeatureShellComponent, SecurityPanelComponent],

  templateUrl: './security-questions-page.component.html',

  styleUrl: './security-questions-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityQuestionsPageComponent implements OnInit {
  protected readonly store = inject(SecurityQuestionsStore);

  private initialized = false;

  protected readonly form = new FormGroup(
    {
      currentPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      answers: new FormArray<QuestionAnswerForm>([
        this.createQuestionForm(),
        this.createQuestionForm(),
        this.createQuestionForm(),
      ]),
    },
    {
      validators: distinctQuestionsValidator(),
    },
  );

  protected readonly removeForm = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor() {
    effect(() => {
      const state = this.store.questions();

      if (!state || this.initialized) {
        return;
      }

      state.questions.slice(0, 3).forEach((question, index) => {
        this.answers.at(index).controls.questionId.setValue(question.questionId, {
          emitEvent: false,
        });
      });

      this.initialized = true;
    });
  }

  ngOnInit(): void {
    this.store.load();
  }

  protected get answers(): FormArray<QuestionAnswerForm> {
    return this.form.controls.answers;
  }

  protected save(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.store.submitting()) {
      return;
    }

    const value = this.form.getRawValue();

    this.store
      .save({
        currentPassword: value.currentPassword,

        answers: value.answers.map((answer) => ({
          questionId: answer.questionId,

          answer: answer.answer.trim(),
        })),
      })
      .subscribe({
        next: () => {
          this.form.controls.currentPassword.reset();

          this.answers.controls.forEach((answer) => {
            answer.controls.answer.reset();
          });
        },
      });
  }

  protected remove(): void {
    this.removeForm.markAllAsTouched();

    if (this.removeForm.invalid || this.store.submitting()) {
      return;
    }

    this.store.remove(this.removeForm.getRawValue()).subscribe({
      next: () => {
        this.removeForm.reset();
        this.form.reset();
        this.initialized = false;
      },
    });
  }

  private createQuestionForm(): QuestionAnswerForm {
    return new FormGroup({
      questionId: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      answer: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(128)],
      }),
    });
  }
}

function distinctQuestionsValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const answers = control.get('answers');

    if (!(answers instanceof FormArray)) {
      return null;
    }

    const ids = answers.controls.map((item) => item.get('questionId')?.value).filter(Boolean);

    return new Set(ids).size === ids.length
      ? null
      : {
          duplicateQuestions: true,
        };
  };
}
