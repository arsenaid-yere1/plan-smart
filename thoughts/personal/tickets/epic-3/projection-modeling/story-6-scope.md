As a user, I want clear feedback if my inputs are unrealistic or incomplete.

## Acceptance Criteria

System validates:
- Ages (current < retirement < lifespan)
- Numeric inputs are non-negative

If inputs are invalid:
- User sees a clear, friendly error message
- Projection does not run

System handles edge cases:
- Zero savings
- Zero contributions
- Very high inflation or low returns
