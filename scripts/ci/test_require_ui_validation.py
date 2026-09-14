import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('gate', Path(__file__).with_name('require-ui-validation.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
SHA = 'a' * 40


def run(**kwargs):
    return dict(id=1, run_attempt=1, head_sha=SHA, head_branch='main', event='push',
                path=gate.WORKFLOW, head_repository={'full_name': gate.REPO},
                status='completed', conclusion='success', html_url='https://github.com/run', **kwargs)


class GateTest(unittest.TestCase):
    def test_rejects_other_sha_branch_event_repo_workflow(self):
        for key, value in [('head_sha', 'b'*40), ('head_branch', 'feature'),
                           ('event', 'pull_request'), ('head_repository', {'full_name': 'fork/repo'}),
                           ('path', '.github/workflows/deploy.yml')]:
            candidate = run()
            candidate[key] = value
            self.assertIsNone(gate.select_run([candidate], SHA), key)

    def test_newest_failure_cannot_reuse_old_success(self):
        newer = run()
        newer.update(id=2, conclusion='failure')
        self.assertEqual(gate.select_run([run(), newer], SHA), newer)
        with patch.object(gate, 'local_revision'), patch.object(gate, 'api', return_value={'workflow_runs': [run(), newer]}):
            with self.assertRaisesRegex(RuntimeError, 'failure'):
                gate.wait_for_ui(SHA, 0)

    def test_missing_pending_cancelled_skipped_block(self):
        for status, conclusion in [('queued', None), ('completed', 'cancelled'), ('completed', 'skipped')]:
            candidate = run()
            candidate.update(status=status, conclusion=conclusion)
            with patch.object(gate, 'local_revision'), patch.object(gate, 'api', return_value={'workflow_runs': [candidate]}):
                with self.assertRaises(RuntimeError):
                    gate.wait_for_ui(SHA, 0)
        with patch.object(gate, 'local_revision'), patch.object(gate, 'api', return_value={'workflow_runs': []}):
            with self.assertRaises(RuntimeError):
                gate.wait_for_ui(SHA, 0)

    def test_requires_actual_job_success(self):
        for jobs in [[], [{'name':'ui-regression', 'conclusion':'skipped'}]]:
            with patch.object(gate, 'local_revision'), patch.object(gate, 'api', side_effect=[{'workflow_runs':[run()]}, {'jobs':jobs}]):
                with self.assertRaisesRegex(RuntimeError, 'job did not succeed'):
                    gate.wait_for_ui(SHA, 0)

    def test_success_rechecks_checkout(self):
        with patch.object(gate, 'local_revision') as check, patch.object(gate, 'api', side_effect=[{'workflow_runs':[run()]}, {'jobs':[{'name':'ui-regression','conclusion':'success'}]}]):
            gate.wait_for_ui(SHA, 0)
            self.assertEqual(check.call_count, 2)

    def test_dirty_or_changed_checkout_blocks_before_api(self):
        with patch.object(gate, 'local_revision', side_effect=RuntimeError('dirty')), patch.object(gate, 'api') as api:
            with self.assertRaises(RuntimeError):
                gate.wait_for_ui(SHA, 0)
            api.assert_not_called()

    def test_local_revision_checks_real_git_outputs(self):
        for outputs in [[SHA, ' M changed'], ['b'*40]]:
            with patch.object(gate.subprocess, 'check_output', side_effect=outputs):
                with self.assertRaises(RuntimeError):
                    gate.local_revision(SHA)

    def test_api_failure_blocks(self):
        with patch.object(gate, 'local_revision'), patch.object(gate, 'api', side_effect=gate.urllib.error.HTTPError('url',403,'Forbidden',{},None)):
            with self.assertRaisesRegex(RuntimeError, 'HTTP 403'):
                gate.wait_for_ui(SHA, 0)


if __name__ == '__main__':
    unittest.main()
