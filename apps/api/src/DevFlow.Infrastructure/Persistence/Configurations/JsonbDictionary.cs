using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal static class JsonbDictionary
{
    /// <summary>
    /// Stores a string dictionary as a JSON document in a jsonb column. The value comparer lets
    /// EF detect changes by content rather than by reference.
    /// </summary>
    public static PropertyBuilder<Dictionary<string, string>> AsJsonb(this PropertyBuilder<Dictionary<string, string>> property) =>
        property
            .HasColumnType("jsonb")
            .HasConversion(
                value => JsonSerializer.Serialize(value, JsonSerializerOptions.Default),
                json => JsonSerializer.Deserialize<Dictionary<string, string>>(json, JsonSerializerOptions.Default) ?? new(),
                new ValueComparer<Dictionary<string, string>>(
                    (a, b) => a!.Count == b!.Count && !a.Except(b).Any(),
                    d => d.Aggregate(0, (hash, pair) => HashCode.Combine(hash, pair.Key, pair.Value)),
                    d => new Dictionary<string, string>(d)));
}
