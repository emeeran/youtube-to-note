/**
 * Health check command for plugin diagnostics
 */

import { OptimizationService } from '../services/optimization-service';
import YoutubeClipperPlugin from '../main';
import { YouTubePluginSettings } from '../types/types';

export class HealthCheckCommand {
    constructor(private plugin: YoutubeClipperPlugin) {}

    async execute(): Promise<void> {
        try {
            const settings = this.plugin.getCurrentSettings();
            const healthCheck = await OptimizationService.runHealthCheck(settings);

            // Log results
            console.log('=== YT-Clipper Health Check ===');
            console.log(`Overall Status: ${healthCheck.overall.toUpperCase()}`);
            console.log(`Health Score: ${healthCheck.score}/100`);

            if (healthCheck.issues.length > 0) {
                console.log('\nIssues Found:');
                healthCheck.issues.forEach((issue, index) => {
                    console.log(`\n${index + 1}. [${issue.status.toUpperCase()}] ${issue.category}`);
                    console.log(`   ${issue.message}`);
                    if (issue.recommendation) {
                        console.log(`   Recommendation: ${issue.recommendation}`);
                    }
                });
            }

            if (healthCheck.recommendations.length > 0) {
                console.log('\nRecommendations:');
                healthCheck.recommendations.forEach((rec, index) => {
                    console.log(`${index + 1}. ${rec}`);
                });
            }

            console.log('\n=== End Health Check ===');

        } catch (error) {
            console.error('Health check failed:', error);
        }
    }
}