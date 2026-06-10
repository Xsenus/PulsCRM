using PulsNext.Infrastructure;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class DispatchDiagnosticsQueryTests
{
    [Theory]
    [InlineData(null, 0)]
    [InlineData(-10, 0)]
    [InlineData(25, 25)]
    public void NormalizeSkip_ReturnsNonNegativeValue(int? value, int expected)
    {
        Assert.Equal(expected, DispatchDiagnosticsQuery.NormalizeSkip(value));
    }

    [Theory]
    [InlineData(null, DispatchDiagnosticsQuery.DefaultTake)]
    [InlineData(0, DispatchDiagnosticsQuery.DefaultTake)]
    [InlineData(-5, DispatchDiagnosticsQuery.DefaultTake)]
    [InlineData(25, 25)]
    [InlineData(1000, DispatchDiagnosticsQuery.MaxTake)]
    public void NormalizeTake_ReturnsSupportedValue(int? value, int expected)
    {
        Assert.Equal(expected, DispatchDiagnosticsQuery.NormalizeTake(value));
    }
}
