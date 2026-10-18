namespace DevFlow.Domain.Common;

/// <summary>Shared by tasks and tickets. Ordered, so "High or above" is a comparison.</summary>
public enum Priority
{
    None = 0,
    Low = 1,
    Medium = 2,
    High = 3,
    Urgent = 4,
}
