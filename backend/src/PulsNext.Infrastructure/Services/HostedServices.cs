using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace PulsNext.Infrastructure;

public sealed class SchedulerHostedService(
    IServiceScopeFactory serviceScopeFactory,
    IOptions<DispatchOptions> dispatchOptions,
    ILogger<SchedulerHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(5, dispatchOptions.Value.SchedulerPollSeconds)));

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = serviceScopeFactory.CreateScope();
                var dispatchService = scope.ServiceProvider.GetRequiredService<IDispatchService>();
                var count = await dispatchService.ScheduleDueCampaignsAsync(stoppingToken);
                if (count > 0)
                {
                    logger.LogInformation("Scheduled {Count} due campaigns", count);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to schedule due campaigns");
            }
        }
    }
}

public sealed class QueuePumpHostedService(
    IServiceScopeFactory serviceScopeFactory,
    IOptions<DispatchOptions> dispatchOptions,
    ILogger<QueuePumpHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(1, dispatchOptions.Value.RecoveryPollSeconds)));

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = serviceScopeFactory.CreateScope();
                var dispatchService = scope.ServiceProvider.GetRequiredService<IDispatchService>();
                var count = await dispatchService.QueueDueItemsAsync(stoppingToken);
                if (count > 0)
                {
                    logger.LogInformation("Queued {Count} dispatch items into in-memory channel", count);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to move due dispatch items into channel");
            }
        }
    }
}

public sealed class RecoveryHostedService(
    IServiceScopeFactory serviceScopeFactory,
    IOptions<DispatchOptions> dispatchOptions,
    ILogger<RecoveryHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(5, dispatchOptions.Value.RecoveryPollSeconds * 3)));

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = serviceScopeFactory.CreateScope();
                var dispatchService = scope.ServiceProvider.GetRequiredService<IDispatchService>();
                var recovered = await dispatchService.RecoverStuckItemsAsync(stoppingToken);
                if (recovered > 0)
                {
                    logger.LogWarning("Recovered {Count} stuck or reserved dispatch items", recovered);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to recover stuck dispatch items");
            }
        }
    }
}

public sealed class SenderHostedService(
    IServiceScopeFactory serviceScopeFactory,
    IDispatchChannel dispatchChannel,
    IOptions<DispatchOptions> dispatchOptions,
    ILogger<SenderHostedService> logger) : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var workerCount = Math.Max(1, dispatchOptions.Value.SenderConcurrency);
        var tasks = Enumerable.Range(0, workerCount).Select(workerId => RunWorkerAsync(workerId, stoppingToken));
        return Task.WhenAll(tasks);
    }

    private async Task RunWorkerAsync(int workerId, CancellationToken stoppingToken)
    {
        await foreach (var dispatchItemId in dispatchChannel.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = serviceScopeFactory.CreateScope();
                var dispatchService = scope.ServiceProvider.GetRequiredService<IDispatchService>();
                await dispatchService.ProcessItemAsync(dispatchItemId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Sender worker {WorkerId} failed to process dispatch item {DispatchItemId}", workerId, dispatchItemId);
            }
        }
    }
}
