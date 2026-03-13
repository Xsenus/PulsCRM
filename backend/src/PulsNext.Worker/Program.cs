using PulsNext.Infrastructure;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "PulsNext Worker";
});

builder.Services.AddPulsNextInfrastructure(builder.Configuration, builder.Environment.ContentRootPath);
builder.Services.AddHostedService<SchedulerHostedService>();
builder.Services.AddHostedService<QueuePumpHostedService>();
builder.Services.AddHostedService<RecoveryHostedService>();
builder.Services.AddHostedService<SenderHostedService>();

var host = builder.Build();
await host.RunAsync();
