import { streamText } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { NextResponse } from 'next/server';

// Create xAI provider with the API key
const xai = createXai({
    apiKey: process.env.ObservationAPIKey || '',
});

export async function POST(req: Request) {
    try {
        const { observations } = await req.json();

        if (!observations || observations.length === 0) {
            return NextResponse.json(
                { error: 'No observations provided' },
                { status: 400 }
            );
        }

        // Check for API key
        if (!process.env.ObservationAPIKey) {
            console.error('Missing ObservationAPIKey environment variable');
            return NextResponse.json(
                { error: 'API key not configured. Please set ObservationAPIKey in your environment.' },
                { status: 500 }
            );
        }

        // Format observations for the AI prompt
        const observationsText = observations.map((obs: any, index: number) => `
Observation ${index + 1}:
- Teacher: ${obs.teacher_name}
- Subject: ${obs.subject}
- Grade: ${obs.grade_level}
- School: ${obs.school_name}
- Observer: ${obs.observer_name}
- Objective Clear: ${obs.objective_visible ? 'Yes' : 'No'}
- Key Concept: ${obs.objective_concept || 'N/A'}
- Student Understanding: ${obs.student_whisper_check}
- Teacher Talk Time: ${Math.round((obs.time_teacher_talking || 0) / 60)} min
- Student Talk Time: ${Math.round((obs.time_student_talking || 0) / 60)} min
- Silence/Work Time: ${Math.round((obs.time_silence || 0) / 60)} min
- Closed Questions: ${obs.count_q_closed}
- Open Questions: ${obs.count_q_open}
- Probe Questions: ${obs.count_q_probe}
- Short Responses: ${obs.count_resp_short}
- Extended Responses: ${obs.count_resp_extended}
- Peer Interactions: ${obs.count_resp_peer}
- Code Switching: ${obs.count_code_switching}
- Formative Methods: ${JSON.stringify(obs.formative_methods_count)}
- Quotes: ${obs.verbatim_quotes || 'None recorded'}
`).join('\n');

        const prompt = `You are an expert education consultant analyzing classroom observation data for a STEM program in Malaysian primary schools (Years 1-6).

Analyze the following classroom observations and provide:
1. Key patterns and trends across all observations
2. Strengths in teaching practices
3. Areas for improvement with specific recommendations
4. School-wide or regional patterns if multiple schools are represented
5. Actionable coaching recommendations for the lead coach

Observations Data:
${observationsText}

Provide your analysis in a structured format with clear headings.`;

        // Stream the response using xAI Grok
        const result = streamText({
            model: xai('grok-4.1-fast-reasoning'),
            prompt,
            temperature: 0.7,
        });

        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error('AI Analysis Error:', error);

        // Provide more specific error messages
        const errorMessage = error?.message || 'Failed to generate analysis';

        return NextResponse.json(
            {
                error: 'Analysis failed',
                details: errorMessage.includes('API key')
                    ? 'Invalid or missing API key. Please check ObservationAPIKey environment variable.'
                    : errorMessage
            },
            { status: 500 }
        );
    }
}
