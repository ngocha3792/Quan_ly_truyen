import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../../../../../shared/components/button/button.component';
import { AuthorConsistencyIssue, AuthorStoryCharacter } from '../../domain/ai-author.models';

@Component({
  selector: 'app-author-knowledge',
  standalone: true,
  imports: [RouterLink, ButtonComponent],
  templateUrl: './author-knowledge.component.html',
  styleUrl: './author-knowledge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorKnowledgeComponent {
  readonly storyId = input.required<string>();
  readonly chapterId = input<string | null>(null);
  readonly sourceVersion = input<number | null>(null);
  readonly characters = input<readonly AuthorStoryCharacter[]>([]);
  readonly issues = input<readonly AuthorConsistencyIssue[]>([]);
  readonly busy = input(false);
  readonly verified = output<AuthorStoryCharacter>();
  readonly issueUpdated = output<{
    id: string;
    input: { isResolved?: boolean; isDismissed?: boolean };
  }>();
}
