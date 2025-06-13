-- Test query to validate prompt_version recording
-- This query will show the most recent answers with their prompt versions

SELECT 
    id,
    question,
    LEFT(answer, 100) as answer_preview,
    model,
    model_name,
    prompt_version,
    date
FROM 
    answers
ORDER BY 
    date DESC
LIMIT 10;

-- Query to compare answer lengths between prompt versions
-- This helps validate that version 2.0 produces more concise answers

SELECT 
    prompt_version,
    AVG(LENGTH(answer)) as avg_answer_length,
    MIN(LENGTH(answer)) as min_answer_length,
    MAX(LENGTH(answer)) as max_answer_length,
    COUNT(*) as answer_count
FROM 
    answers
GROUP BY 
    prompt_version
ORDER BY 
    prompt_version;
