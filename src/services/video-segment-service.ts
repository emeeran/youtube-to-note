/**
 * Video Segment/Chapter Processing Service
 * Extract and process specific time ranges from videos
 */

export interface VideoSegment {
    startTime: number;  // seconds
    endTime: number;    // seconds
    title?: string;
    description?: string;
}

export interface Chapter extends VideoSegment {
    chapterNumber: number;
}

export class VideoSegmentService {
    /**
     * Extract segment from transcript based on time range
     */
    extractSegment(transcript: string, segments: VideoSegment[]): string[] {
        return segments.map(segment => {
            const lines = transcript.split('\n');
            const segmentLines: string[] = [];

            for (const line of lines) {
                const timestampMatch = line.match(/\[(\d+):(\d+)\]/);
                if (timestampMatch) {
                    const minutes = parseInt(timestampMatch[1]);
                    const seconds = parseInt(timestampMatch[2]);
                    const time = minutes * 60 + seconds;

                    if (time >= segment.startTime && time <= segment.endTime) {
                        segmentLines.push(line);
                    }
                }
            }

            return segmentLines.join('\n');
        });
    }

    /**
     * Parse chapters from video description
     */
    parseChapters(description: string): Chapter[] {
        const chapters: Chapter[] = [];
        const chapterRegex = /(\d+):(\d+)(?::(\d+))?\s+([^\n]+)/g;

        let match;
        let chapterNumber = 1;

        while ((match = chapterRegex.exec(description)) !== null) {
            const hours = match[3] ? parseInt(match[3]) : 0;
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const startTime = hours * 3600 + minutes * 60 + seconds;
            const title = match[4].trim();

            chapters.push({
                chapterNumber,
                startTime,
                endTime: 0, // Will be calculated
                title,
            });

            chapterNumber++;
        }

        // Calculate end times
        for (let i = 0; i < chapters.length - 1; i++) {
            chapters[i].endTime = chapters[i + 1].startTime;
        }
        if (chapters.length > 0) {
            chapters[chapters.length - 1].endTime = Infinity;
        }

        return chapters;
    }

    /**
     * Create segment from timestamp range
     */
    createSegment(startTime: number, endTime: number, title?: string): VideoSegment {
        return { startTime, endTime, title };
    }

    /**
     * Parse timestamp string (e.g., "1:23" or "1:23:45")
     */
    parseTimestamp(timestamp: string): number {
        const parts = timestamp.split(':').map(Number);

        if (parts.length === 3) {
            // hours:minutes:seconds
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            // minutes:seconds
            return parts[0] * 60 + parts[1];
        } else {
            // seconds
            return parts[0];
        }
    }

    /**
     * Format timestamp to string
     */
    formatTimestamp(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Process transcript by chapters
     */
    processByChapters(transcript: string, chapters: Chapter[]): Map<Chapter, string> {
        const result = new Map<Chapter, string>();

        for (const chapter of chapters) {
            const segmentLines: string[] = [];
            const lines = transcript.split('\n');

            for (const line of lines) {
                const timestampMatch = line.match(/\[(\d+):(\d+)\]/);
                if (timestampMatch) {
                    const minutes = parseInt(timestampMatch[1]);
                    const seconds = parseInt(timestampMatch[2]);
                    const time = minutes * 60 + seconds;

                    if (time >= chapter.startTime && time <= chapter.endTime) {
                        segmentLines.push(line);
                    }
                }
            }

            result.set(chapter, segmentLines.join('\n'));
        }

        return result;
    }
}

export const videoSegmentService = new VideoSegmentService();
