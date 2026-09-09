# Deployment Approval Log Design

## Goal

Make deployment action logs clearer about the approval gate and update the
GitHub Actions used by the Pages deployment workflow without weakening the
existing protected environment.

## Design

Keep the `github-pages` environment on the deploy job. GitHub pauses the job
until an allowed reviewer approves it, and the reviewer identity remains
authoritatively recorded in the repository's Environment and Deployment UI.

After the environment gate has passed, add a logging step that writes both to
the action log and the job summary:

- workflow run URL and run ID;
- commit SHA and branch;
- `github.actor`, the original workflow trigger actor;
- `github.triggering_actor`, the actor responsible for the current run or
  rerun;
- an explicit note that the Environment approval reviewer is recorded by
  GitHub in the Deployment/Environment details.

The workflow must not label either actor as the approver because GitHub does
not expose the actual Environment reviewer in the post-approval job context.

Update action references to `actions/checkout@v5`,
`actions/configure-pages@v5`, and `actions/upload-pages-artifact@v4`.
Retain `actions/deploy-pages@v4`, which is already the current reference in
the workflow.

## Validation and compatibility

The workflow remains push-triggered on `main`, retains least-privilege Pages
permissions, and continues uploading the repository root. Validate the YAML
diff, confirm all intended action versions and approval metadata are present,
and ensure no application files or deployment protection settings change.
