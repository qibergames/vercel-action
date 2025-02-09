import core from '@actions/core';
import { vercelDeploy } from './deploy';

vercelDeploy().catch((error) => {
    core.setFailed((error as Error).message);
});
