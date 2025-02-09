import core from '@actions/core';
import type { GetDeploymentResponseBody1 } from '@vercel/sdk/models/getdeploymentop';
import { aliasDomains, octokit } from './config';
import { context } from '@actions/github';

const stateEmoji: Record<
    NonNullable<GetDeploymentResponseBody1['status']>,
    string
> = {
    READY: '✅ Ready',
    ERROR: '❌ Failed',
    QUEUED: '🕒 Queued',
    BUILDING: '🔨 Building',
    INITIALIZING: '🏗️ Initializing',
    CANCELED: '❎ Canceled',
};

const prefix = '[vc]:';

export async function createOrCreateCommentOnPullRequest(
    deployment: GetDeploymentResponseBody1,
): Promise<void> {
    const commentId = await findPreviousComment();
    const updatedDate = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    const previewColumn = deployment.aliasAssigned
        ? `[Visit Preview](https://${aliasDomains[0]})`
        : '';
    const commentsColumn = deployment.aliasAssigned
        ? `💬 [**Add feedback**](https://vercel.live/open-feedback/${aliasDomains[0]}?via=pr-comment-feedback-link)`
        : '';
    const commentBody = `${prefix} #${deployment.id}
**The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)

| Name | Status | Preview | Comments | Updated (UTC) |
| :--- | :----- | :------ | :------- | :------ |
| **${deployment.project?.name}** | ${stateEmoji[deployment.status]} ([Inspect](${deployment.inspectorUrl})) | ${previewColumn} | ${commentsColumn} | ${updatedDate} |`;

    if (commentId) {
        await octokit.rest.issues.updateComment({
            ...context.repo,
            comment_id: commentId,
            body: commentBody,
        });
    } else {
        await octokit.rest.issues.createComment({
            ...context.repo,
            issue_number: context.issue.number,
            body: commentBody,
        });
    }
}

/**
 * Retrieve the list of comments for the current commit or pull request.
 */
async function findPreviousComment() {
    core.debug(`Pull request event detected: listing issue comments`);
    const { data } = await octokit.rest.issues.listComments({
        ...context.repo,
        issue_number: context.issue.number,
    });
    return data.find((c) => c.body?.startsWith(prefix))?.id;
}
