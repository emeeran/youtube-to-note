/**
 * Cross-Referencing System
 * Auto-link related videos and suggest similar content
 */

export interface VideoReference {
    videoId: string;
    url: string;
    title: string;
    similarity: number;
    relevanceScore: number;
}

export class CrossReferenceService {
    private processedVideos: Map<string, Set<string>> = new Map();

    /**
     * Link related videos based on content similarity
     */
    findRelatedVideos(videoId: string, title: string, transcript: string): VideoReference[] {
        const related: VideoReference[] = [];
        const keywords = this.extractKeywords(title, transcript);

        for (const [otherId, otherData] of this.processedVideos.entries()) {
            if (otherId === videoId) continue;

            const similarity = this.calculateSimilarity(keywords, otherData);
            if (similarity > 0.3) {
                related.push({
                    videoId: otherId,
                    url: `https://www.youtube.com/watch?v=${otherId}`,
                    title: otherData.title,
                    similarity,
                    relevanceScore: this.calculateRelevance(similarity, otherData.timestamp),
                });
            }
        }

        return related.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * Extract keywords from title and transcript
     */
    private extractKeywords(title: string, transcript: string): Set<string> {
        const text = (title + ' ' + transcript).toLowerCase();
        const words = text.split(/\W+/);
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once']);

        return new Set(words.filter(word => word.length > 3 && !stopWords.has(word)));
    }

    /**
     * Calculate similarity between two sets of keywords
     */
    private calculateSimilarity(keywords1: Set<string>, data2: any): number {
        const intersection = new Set(
            Array.from(keywords1).filter(x => data2.keywords.has(x))
        );

        const union = new Set([...keywords1, ...data2.keywords]);

        return intersection.size / union.size;
    }

    /**
     * Calculate relevance score based on similarity and recency
     */
    private calculateRelevance(similarity: number, timestamp: number): number {
        const recency = Math.max(0, 1 - (Date.now() - timestamp) / (30 * 24 * 60 * 60 * 1000)); // Decay over 30 days
        return similarity * 0.7 + recency * 0.3;
    }

    /**
     * Store processed video for cross-referencing
     */
    storeVideo(videoId: string, title: string, transcript: string): void {
        this.processedVideos.set(videoId, {
            title,
            keywords: this.extractKeywords(title, transcript),
            timestamp: Date.now(),
        });
    }

    /**
     * Suggest similar content
     */
    suggestSimilar(videoId: string, title: string, transcript: string, limit: number = 5): string[] {
        const related = this.findRelatedVideos(videoId, title, transcript);
        return related.slice(0, limit).map(r => r.url);
    }

    /**
     * Create cross-reference links for notes
     */
    createCrossReferenceLinks(videoId: string, title: string, transcript: string): string {
        const related = this.findRelatedVideos(videoId, title, transcript);

        if (related.length === 0) {
            return '';
        }

        const links = related.slice(0, 5).map(ref => {
            return `- [${ref.title}](${ref.url}) (${Math.round(ref.similarity * 100)}% similar)`;
        });

        return `\n## Related Videos\n\n${links.join('\n')}\n`;
    }
}

export const crossReferenceService = new CrossReferenceService();
