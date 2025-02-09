import { isDebug as gh_idDebug } from '@actions/core';
import github from '@actions/github';

// GitHub inputs
export const githubToken = process.env.GITHUB_TOKEN!;
export const workingDirectory = process.env.WORKING_DIRECTORY;
export const isDebug = process.env.DEBUG === 'true' || gh_idDebug();

// Vercel inputs
export const vercelToken = process.env.VERCEL_TOKEN!;
export const vercelOrgId = process.env.VERCEL_ORG_ID;
export const vercelProjectId = process.env.VERCEL_PROJECT_ID;
export const aliasDomains =
    process.env.ALIAS_DOMAINS?.split('\n').filter(Boolean) || [];

export const octokit = github.getOctokit(githubToken);
