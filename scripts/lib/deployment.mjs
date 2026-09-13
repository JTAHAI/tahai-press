import process from 'node:process';

function clean(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function deploymentContext(env = process.env) {
  const productionBranch = clean(env.PUBLICATION_PRODUCTION_BRANCH, 'main');
  const configuredProvider = clean(env.PUBLICATION_DEPLOYMENT_PROVIDER);
  const branch = clean(
    env.CF_PAGES_BRANCH || env.PUBLICATION_DEPLOYMENT_BRANCH || env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME,
    'local'
  );
  const provider = env.CF_PAGES === '1'
    ? 'cloudflare-pages'
    : configuredProvider === 'cloudflare-workers'
      ? 'cloudflare-workers'
    : env.GITHUB_ACTIONS === 'true'
      ? 'github-actions'
      : 'local';
  const forcedPreview = env.PUBLICATION_FORCE_PREVIEW === '1';
  const isCloudflareStatic = provider === 'cloudflare-pages' || provider === 'cloudflare-workers';
  const isPreview = forcedPreview || (isCloudflareStatic && branch !== productionBranch);
  const environment = isPreview
    ? 'preview'
    : isCloudflareStatic
      ? 'production'
      : 'local';
  const commit = clean(env.CF_PAGES_COMMIT_SHA || env.PUBLICATION_DEPLOYMENT_COMMIT || env.GITHUB_SHA, 'local');
  const deploymentUrl = clean(env.CF_PAGES_URL || env.PUBLICATION_DEPLOYMENT_URL, '');

  return {
    provider,
    environment,
    isPreview,
    branch,
    productionBranch,
    commit,
    shortCommit: commit === 'local' ? 'local' : commit.slice(0, 12),
    deploymentUrl
  };
}
