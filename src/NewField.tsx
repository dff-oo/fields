import { useMemo, useState } from 'react';
import { storyFileSchema, type StoryFile } from './story/schema';
import type { Resources } from './api';
import { emptyStory } from './edit';
import { SearchSelect, namedOptions } from './SearchSelect';

/** Parses an uploaded story file, or returns what is wrong with it. */
export async function readStory(upload: File): Promise<{ file: StoryFile } | { errors: string[] }> {
  let data: unknown;
  try {
    data = JSON.parse(await upload.text());
  } catch {
    return { errors: [`${upload.name} is not valid JSON.`] };
  }
  const parsed = storyFileSchema.safeParse(data);
  if (!parsed.success) {
    return { errors: parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`) };
  }
  return { file: parsed.data };
}

export function NewField(props: {
  resources: Resources;
  onCreate: (file: StoryFile) => void;
  onCancel?: () => void;
}) {
  const [field, setField] = useState<string | null>(null);
  const [typedField, setTypedField] = useState('');
  const fields = useMemo(() => namedOptions(props.resources.fields), [props.resources.fields]);
  const fieldId = fields.length ? Number(field) : Number(typedField);

  return (
    <div className="start">
      <div className="start-new">
        {fields.length ? (
          <SearchSelect label="Field" options={fields} value={field} onChange={setField} placeholder="Search fields" />
        ) : (
          <label>
            Field id (run npm run resources for the field list)
            <input type="number" min="1" value={typedField} onChange={(event) => setTypedField(event.target.value)} />
          </label>
        )}
        <div className="start-actions">
          {props.onCancel && <button type="button" onClick={props.onCancel}>Cancel</button>}
          <button type="button" disabled={!(fieldId > 0)} onClick={() => props.onCreate(emptyStory(fieldId))}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
