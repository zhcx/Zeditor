import test from 'node:test';
import assert from 'node:assert/strict';
import { WysiwygSession } from '../src/components/Wysiwyg/wysiwygSession.ts';

test('WYSIWYG content revision advances for external source synchronization', () => {
  const session = new WysiwygSession('before', {
    onSourceChange: () => undefined,
    insertClipboardImage: async () => false,
  });
  const initial = session.getContentRevision();
  session.syncExternalSource('external');
  assert.ok(session.getContentRevision() > initial);
  const afterExternal = session.getContentRevision();
  session.syncExternalSource('external');
  assert.equal(session.getContentRevision(), afterExternal);
});
