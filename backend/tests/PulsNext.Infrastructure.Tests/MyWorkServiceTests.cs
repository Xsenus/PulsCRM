using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class MyWorkServiceTests : IDisposable
{
    private readonly LegacyUnitOfWork _unitOfWork = new(new SimpleDataLayer(new InMemoryDataStore()));

    public void Dispose() => _unitOfWork.Dispose();

    [Fact]
    public void ShowsOnlyOpenJobsOfTheCurrentEmployeeOrderedByDeadline()
    {
        var me = new LegacyUser(_unitOfWork) { Name = "me", FullName = "Иванов Иван" };
        var boss = new LegacyUser(_unitOfWork) { Name = "boss", FullName = "Петрова Анна" };
        var other = new LegacyUser(_unitOfWork) { Name = "other", FullName = "Сидоров Петр" };
        var org = new LegacyOrg(_unitOfWork) { Name = "ООО «Ромашка»" };
        var today = new DateTime(2026, 11, 17);

        Job(boss, me, "Без срока", DateTime.MinValue);
        Job(boss, me, "Через неделю", today.AddDays(7), org);
        Job(boss, me, "Просрочено", today.AddDays(-2));
        Job(boss, me, "На сегодня", today);
        Job(boss, me, "Выполнено", today.AddDays(-5), completed: today.AddDays(-1));
        Job(boss, other, "Чужое", today);
        Job(me, other, "Поручил Сидорову", today.AddDays(3));
        Job(me, me, "Себе", today.AddDays(1));
        _unitOfWork.CommitChanges();

        var result = new MyWorkService(_unitOfWork, new FixedUser(me.Oid), new FixedTime(today.AddHours(10))).Get(10);

        Assert.Equal(["Просрочено", "На сегодня", "Себе", "Через неделю", "Без срока"], result.Assigned.Select(x => x.Message));
        Assert.Equal(5, result.AssignedTotal);
        Assert.Equal(1, result.Overdue);
        Assert.Equal("ООО «Ромашка»", result.Assigned.Single(x => x.Message == "Через неделю").OrgName);
        Assert.Equal("Петрова Анна", result.Assigned.First().UserFromName);
        // «Я поручил» — только другим, «себе» там не повторяется.
        Assert.Equal(["Поручил Сидорову"], result.Delegated.Select(x => x.Message));
        Assert.Equal(1, result.DelegatedTotal);

        var limited = new MyWorkService(_unitOfWork, new FixedUser(me.Oid), new FixedTime(today)).Get(2);
        Assert.Equal(2, limited.Assigned.Count);
        Assert.Equal(5, limited.AssignedTotal);
    }

    private void Job(LegacyUser from, LegacyUser to, string message, DateTime dateTo, LegacyOrg? org = null, DateTime? completed = null)
        => _ = new LegacyJob(_unitOfWork) { UserFrom = from, UserTo = to, Message = message, DateTo = dateTo, Org = org, DateCompleted = completed ?? DateTime.MinValue, Date_create = new DateTime(2026, 11, 1) };

    private sealed class FixedUser(int id) : ICurrentUserAccessor
    {
        public int? GetLegacyUserId() => id;
        public string? GetLogin() => null;
    }

    private sealed class FixedTime(DateTime local) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(DateTime.SpecifyKind(local, DateTimeKind.Utc));
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }
}
