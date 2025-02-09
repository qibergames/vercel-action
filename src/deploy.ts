import { getExecOutput } from '@actions/exec';
import { context } from '@actions/github';
import {
    createDeployment,
    type DeploymentOptions,
    type VercelClientOptions,
} from '@vercel/client'; // Make sure the SDK is installed and its API matches these calls
import { Vercel } from '@vercel/sdk';
import { readFile } from 'fs/promises';
import {
    aliasDomains,
    isDebug,
    vercelOrgId,
    vercelProjectId,
    vercelToken,
    workingDirectory,
} from './config';
import { createOrCreateCommentOnPullRequest } from './pr';
import { debug } from '@actions/core';
import { version } from '../package.json';
import type { GetDeploymentResponseBody1 } from '@vercel/sdk/models/getdeploymentop.js';

/**
 * Deploy to Vercel using the SDK.
 *
 * @param ref The git ref (branch)
 * @param commit The commit message
 * @returns A deployment object containing at least the deployment id and url.
 */
export async function vercelDeploy() {
    console.log(`Vercel Deploy Action v${version}`);

    const buildConfig = JSON.parse(
        (await readFile('.vercel/output/builds.json')).toString(),
    );
    const latestCommit = (
        await getExecOutput('git show -s --format=%s')
    ).stdout.trim();
    const cwd = workingDirectory ?? process.cwd();
    const clientOptions: VercelClientOptions = {
        prebuilt: true,
        path: cwd,
        token: vercelToken,
        vercelOutputDir: './.vercel/output',
        teamId: vercelOrgId,
        debug: isDebug,
    };
    const outConfig = buildConfig.builds[0].config;
    const deploymentOptions: DeploymentOptions = {
        projectSettings: {
            framework: outConfig.framework,
            installCommand: outConfig.installCommand,
            buildCommand: outConfig.buildCommand,
            outputDirectory: outConfig.outputDirectory,
        },
        name: vercelProjectId,
        meta: {
            githubCommitSha: context.sha,
            githubCommitAuthorName: context.actor,
            githubCommitAuthorLogin: context.actor,
            githubDeployment: '1',
            githubOrg: context.repo.owner,
            githubRepo: context.repo.repo,
            githubCommitOrg: context.repo.owner,
            githubCommitRepo: context.repo.repo,
            githubCommitMessage: latestCommit,
            githubCommitRef: context.ref.replace('refs/heads/', ''),
        },
    };
    let deployment: GetDeploymentResponseBody1;
    debug(`client options: ${JSON.stringify(clientOptions, null, 2)}`);
    debug(`deployment options: ${JSON.stringify(deploymentOptions, null, 2)}`);
    try {
        for await (const event of createDeployment(
            clientOptions,
            deploymentOptions,
        )) {
            if (
                event.type === 'created' ||
                event.type === 'ready' ||
                event.type === 'building' ||
                event.type === 'alias-assigned'
            ) {
                const payload = event.payload as GetDeploymentResponseBody1;
                deployment = payload;
                await createOrCreateCommentOnPullRequest(payload);
            }
            if (event.type === 'error') {
                if (deployment!) {
                    await createOrCreateCommentOnPullRequest({
                        ...deployment,
                        status: 'ERROR',
                    });
                }
                console.error(event.payload);
                throw new Error(event.payload);
            }
        }
        const vercel = new Vercel({ bearerToken: process.env.VERCEL_TOKEN! });
        for (const alias of aliasDomains) {
            await vercel.aliases.assignAlias({
                id: deployment!.id,
                requestBody: {
                    alias,
                },
                teamId: vercelOrgId,
            });
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
