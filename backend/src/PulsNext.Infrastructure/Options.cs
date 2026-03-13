namespace PulsNext.Infrastructure;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "PulsNext.Api";
    public string Audience { get; set; } = "PulsNext.Web";
    public string SigningKey { get; set; } = "CHANGE_ME_TO_LONG_RANDOM_SECRET";
    public int AccessTokenMinutes { get; set; } = 480;
}

public sealed class DispatchOptions
{
    public const string SectionName = "Dispatch";

    public int SchedulerPollSeconds { get; set; } = 15;
    public int RecoveryPollSeconds { get; set; } = 5;
    public int DueCampaignBatchSize { get; set; } = 10;
    public int QueueBatchSize { get; set; } = 200;
    public int ChannelCapacity { get; set; } = 4000;
    public int SenderConcurrency { get; set; } = 4;
    public int RetryBaseDelayMinutes { get; set; } = 3;
    public int RetryMaxDelayMinutes { get; set; } = 30;
    public string WorkerNode { get; set; } = Environment.MachineName;
}

public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    public string RootPath { get; set; } = "../../../../storage";
    public string UploadsPath { get; set; } = "uploads";
    public string KeysPath { get; set; } = "keys";
    public long MaxFileSizeBytes { get; set; } = 25 * 1024 * 1024;
}

public sealed class LegacyDbOptions
{
    public const string SectionName = "LegacyDb";

    public bool Enabled { get; set; } = true;
}

public sealed class MailingDbOptions
{
    public const string SectionName = "MailingDb";

    public bool AutoCreateSchema { get; set; } = true;
}
