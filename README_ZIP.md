```markdown
# How to create a release ZIP for this project

Two options: locally (quick) or via GitHub Actions (recommended for CI).

A. Locally using the provided script
1. Save create_release_zip.sh to the repository root and make executable:
   chmod +x create_release_zip.sh

2. Run:
   ./create_release_zip.sh my-release.zip

   - If repository is a git repo the script uses `git archive` to include tracked files from configured include paths.
   - If not a git repo, the script copies specified include paths into a temp folder and zips them.
   - The script excludes common large/sensitive paths (node_modules, server/data, .env, certificates). Edit the script to customize.

B. Using GitHub Actions
1. The workflow `.github/workflows/package_release.yml` is included.
2. Trigger it manually from the Actions tab (workflow_dispatch) or push to main.
3. The Action will produce an artifact `release-zip` available to download from the workflow run page.

Notes
- Ensure secrets (JWT_SECRET, etc.) are NOT committed to the repo. Provide them as environment variables in your running environment or Docker compose.
- For production deploy, prefer building platform-specific Flutter artifacts separately and ship the source + build steps in CI instead of committing build outputs.
```