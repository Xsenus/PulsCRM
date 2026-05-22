using DevExpress.Xpo;
using System.ComponentModel;
using DisplayName = System.ComponentModel.DisplayNameAttribute;

namespace PulsNext.Domain.Mailing;

/// <summary>
/// Список XPO-сущностей модуля рассылок, которые должны быть зарегистрированы в хранилище.
/// </summary>
public static class MailingPersistentTypes
{
    public static readonly Type[] All =
    {
        typeof(MailTransportProfile),
        typeof(MailCampaign),
        typeof(MailCampaignTargetOrganization),
        typeof(MailStoredFile),
        typeof(MailCampaignAttachment),
        typeof(MailDispatchBatch),
        typeof(MailDispatchItem)
    };
}

/// <summary>
/// Текущее состояние кампании рассылки.
/// </summary>
public enum CampaignStatus
{
    /// <summary>
    /// Кампания создана, но еще не запускается.
    /// </summary>
    Draft = 0,

    /// <summary>
    /// Кампания активна и может выполняться по расписанию.
    /// </summary>
    Active = 1,

    /// <summary>
    /// Кампания временно приостановлена.
    /// </summary>
    Paused = 2,

    /// <summary>
    /// Кампания завершена и больше не должна запускаться.
    /// </summary>
    Completed = 3,

    /// <summary>
    /// Кампания убрана в архив.
    /// </summary>
    Archived = 4
}

/// <summary>
/// Тип расписания, по которому запускается кампания.
/// </summary>
public enum ScheduleKind
{
    /// <summary>
    /// Однократный запуск.
    /// </summary>
    OneTime = 0,

    /// <summary>
    /// Запуск через фиксированный интервал.
    /// </summary>
    FixedInterval = 1,

    /// <summary>
    /// Запуск через случайный интервал в заданных границах.
    /// </summary>
    RandomInterval = 2,

    /// <summary>
    /// Запуск по cron-выражению.
    /// </summary>
    Cron = 3
}

/// <summary>
/// Тип вложения, привязанного к кампании.
/// </summary>
public enum AttachmentKind
{
    /// <summary>
    /// Обычный файл-вложение.
    /// </summary>
    File = 0,

    /// <summary>
    /// Встроенное изображение для HTML-письма.
    /// </summary>
    InlineImage = 1
}

/// <summary>
/// Состояние отдельной записи в очереди отправки.
/// </summary>
public enum DispatchStatus
{
    /// <summary>
    /// Запись поставлена в очередь.
    /// </summary>
    Queued = 0,

    /// <summary>
    /// Отправка выполняется прямо сейчас.
    /// </summary>
    Processing = 1,

    /// <summary>
    /// Письмо успешно отправлено.
    /// </summary>
    Sent = 2,

    /// <summary>
    /// Отправка завершилась ошибкой.
    /// </summary>
    Failed = 3,

    /// <summary>
    /// Отправка была отменена.
    /// </summary>
    Cancelled = 4,

    /// <summary>
    /// Отправка отложена до следующей попытки.
    /// </summary>
    Deferred = 5
}

/// <summary>
/// Причина создания партии отправки.
/// </summary>
public enum DispatchTriggerKind
{
    /// <summary>
    /// Партия создана планировщиком по расписанию.
    /// </summary>
    Scheduled = 0,

    /// <summary>
    /// Партия создана вручную оператором.
    /// </summary>
    Manual = 1,

    /// <summary>
    /// Партия создана при повторной попытке отправки.
    /// </summary>
    Retry = 2
}

/// <summary>
/// Источник, из которого был получен адрес получателя.
/// </summary>
public enum RecipientSourceKind
{
    /// <summary>
    /// Адрес указан вручную.
    /// </summary>
    Manual = 0,

    /// <summary>
    /// Основной email организации.
    /// </summary>
    OrgPrimary = 1,

    /// <summary>
    /// Email контактного лица организации.
    /// </summary>
    Contact = 2,

    /// <summary>
    /// Почта для зарплатного обмена.
    /// </summary>
    Salary = 3,

    /// <summary>
    /// Почта для обмена с 1С.
    /// </summary>
    OneC = 4,

    /// <summary>
    /// Почта, связанная с сайтом организации.
    /// </summary>
    Site = 5,

    /// <summary>
    /// Почта руководителя организации.
    /// </summary>
    Director = 6
}

[Persistent("MailTransportProfile")]
public class MailTransportProfile(Session session) : XPObject(session)
{
    private string? _name;
    private string? _host;
    private int _port;
    private bool _useSsl;
    private string? _username;
    private string? _passwordProtected;
    private string? _senderEmail;
    private string? _senderName;
    private string? _replyToEmail;
    private int _maxConnections;
    private int _messagesPerMinute;
    private bool _isDefault;
    private bool _isEnabled;
    private DateTime _createdAtUtc;
    private DateTime _updatedAtUtc;

    public MailTransportProfile() : this(Session.DefaultSession) { }

    [Size(256)]
    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    [Size(512)]
    public string? Host
    {
        get => _host;
        set => SetPropertyValue(nameof(Host), ref _host, value);
    }

    public int Port
    {
        get => _port;
        set => SetPropertyValue(nameof(Port), ref _port, value);
    }

    public bool UseSsl
    {
        get => _useSsl;
        set => SetPropertyValue(nameof(UseSsl), ref _useSsl, value);
    }

    [Size(256)]
    public string? Username
    {
        get => _username;
        set => SetPropertyValue(nameof(Username), ref _username, value);
    }

    [Size(SizeAttribute.Unlimited)]
    public string? PasswordProtected
    {
        get => _passwordProtected;
        set => SetPropertyValue(nameof(PasswordProtected), ref _passwordProtected, value);
    }

    [Size(256)]
    public string? SenderEmail
    {
        get => _senderEmail;
        set => SetPropertyValue(nameof(SenderEmail), ref _senderEmail, value);
    }

    [Size(256)]
    public string? SenderName
    {
        get => _senderName;
        set => SetPropertyValue(nameof(SenderName), ref _senderName, value);
    }

    [Size(256)]
    public string? ReplyToEmail
    {
        get => _replyToEmail;
        set => SetPropertyValue(nameof(ReplyToEmail), ref _replyToEmail, value);
    }

    public int MaxConnections
    {
        get => _maxConnections;
        set => SetPropertyValue(nameof(MaxConnections), ref _maxConnections, value);
    }

    public int MessagesPerMinute
    {
        get => _messagesPerMinute;
        set => SetPropertyValue(nameof(MessagesPerMinute), ref _messagesPerMinute, value);
    }

    public bool IsDefault
    {
        get => _isDefault;
        set => SetPropertyValue(nameof(IsDefault), ref _isDefault, value);
    }

    public bool IsEnabled
    {
        get => _isEnabled;
        set => SetPropertyValue(nameof(IsEnabled), ref _isEnabled, value);
    }

    public DateTime CreatedAtUtc
    {
        get => _createdAtUtc;
        set => SetPropertyValue(nameof(CreatedAtUtc), ref _createdAtUtc, value);
    }

    public DateTime UpdatedAtUtc
    {
        get => _updatedAtUtc;
        set => SetPropertyValue(nameof(UpdatedAtUtc), ref _updatedAtUtc, value);
    }

    [Association("Profile-Campaigns")]
    public XPCollection<MailCampaign> Campaigns => GetCollection<MailCampaign>(nameof(Campaigns));
}

[Persistent("MailCampaign")]
public class MailCampaign(Session session) : XPObject(session)
{
    private string? _name;
    private string? _subject;
    private string? _htmlBody;
    private string? _plainTextBody;
    private CampaignStatus _status;
    private MailTransportProfile? _transportProfile;
    private ScheduleKind _scheduleKind;
    private string? _cronExpression;
    private string? _timeZoneId;
    private DateTime _startAtUtc;
    private DateTime _endAtUtc;
    private int _intervalMinutes;
    private int _randomIntervalMinMinutes;
    private int _randomIntervalMaxMinutes;
    private DateTime _nextRunAtUtc;
    private DateTime _lastRunAtUtc;
    private DateTime _lastRunStartedAtUtc;
    private DateTime _lastRunFinishedAtUtc;
    private int _createdByLegacyUserId;
    private int _updatedByLegacyUserId;
    private DateTime _createdAtUtc;
    private DateTime _updatedAtUtc;
    private int _maxRecipientsPerRun;
    private int _maxAttempts;
    private bool _useOrgPrimaryEmail;
    private bool _useContactEmails;
    private bool _useSalaryEmail;
    private bool _useOneCEmail;
    private bool _useSiteEmail;
    private bool _useDirectorEmail;
    private string? _manualRecipientsCsv;

    public MailCampaign() : this(Session.DefaultSession) { }

    [Size(256)]
    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    [Size(512)]
    public string? Subject
    {
        get => _subject;
        set => SetPropertyValue(nameof(Subject), ref _subject, value);
    }

    [Size(SizeAttribute.Unlimited)]
    public string? HtmlBody
    {
        get => _htmlBody;
        set => SetPropertyValue(nameof(HtmlBody), ref _htmlBody, value);
    }

    [Size(SizeAttribute.Unlimited)]
    public string? PlainTextBody
    {
        get => _plainTextBody;
        set => SetPropertyValue(nameof(PlainTextBody), ref _plainTextBody, value);
    }

    public CampaignStatus Status
    {
        get => _status;
        set => SetPropertyValue(nameof(Status), ref _status, value);
    }

    [Association("Profile-Campaigns")]
    public MailTransportProfile? TransportProfile
    {
        get => _transportProfile;
        set => SetPropertyValue(nameof(TransportProfile), ref _transportProfile, value);
    }

    public ScheduleKind ScheduleKind
    {
        get => _scheduleKind;
        set => SetPropertyValue(nameof(ScheduleKind), ref _scheduleKind, value);
    }

    [Size(256)]
    public string? CronExpression
    {
        get => _cronExpression;
        set => SetPropertyValue(nameof(CronExpression), ref _cronExpression, value);
    }

    [Size(128)]
    public string? TimeZoneId
    {
        get => _timeZoneId;
        set => SetPropertyValue(nameof(TimeZoneId), ref _timeZoneId, value);
    }

    public DateTime StartAtUtc
    {
        get => _startAtUtc;
        set => SetPropertyValue(nameof(StartAtUtc), ref _startAtUtc, value);
    }

    public DateTime EndAtUtc
    {
        get => _endAtUtc;
        set => SetPropertyValue(nameof(EndAtUtc), ref _endAtUtc, value);
    }

    public int IntervalMinutes
    {
        get => _intervalMinutes;
        set => SetPropertyValue(nameof(IntervalMinutes), ref _intervalMinutes, value);
    }

    public int RandomIntervalMinMinutes
    {
        get => _randomIntervalMinMinutes;
        set => SetPropertyValue(nameof(RandomIntervalMinMinutes), ref _randomIntervalMinMinutes, value);
    }

    public int RandomIntervalMaxMinutes
    {
        get => _randomIntervalMaxMinutes;
        set => SetPropertyValue(nameof(RandomIntervalMaxMinutes), ref _randomIntervalMaxMinutes, value);
    }

    public DateTime NextRunAtUtc
    {
        get => _nextRunAtUtc;
        set => SetPropertyValue(nameof(NextRunAtUtc), ref _nextRunAtUtc, value);
    }

    public DateTime LastRunAtUtc
    {
        get => _lastRunAtUtc;
        set => SetPropertyValue(nameof(LastRunAtUtc), ref _lastRunAtUtc, value);
    }

    public DateTime LastRunStartedAtUtc
    {
        get => _lastRunStartedAtUtc;
        set => SetPropertyValue(nameof(LastRunStartedAtUtc), ref _lastRunStartedAtUtc, value);
    }

    public DateTime LastRunFinishedAtUtc
    {
        get => _lastRunFinishedAtUtc;
        set => SetPropertyValue(nameof(LastRunFinishedAtUtc), ref _lastRunFinishedAtUtc, value);
    }

    public int CreatedByLegacyUserId
    {
        get => _createdByLegacyUserId;
        set => SetPropertyValue(nameof(CreatedByLegacyUserId), ref _createdByLegacyUserId, value);
    }

    public int UpdatedByLegacyUserId
    {
        get => _updatedByLegacyUserId;
        set => SetPropertyValue(nameof(UpdatedByLegacyUserId), ref _updatedByLegacyUserId, value);
    }

    public DateTime CreatedAtUtc
    {
        get => _createdAtUtc;
        set => SetPropertyValue(nameof(CreatedAtUtc), ref _createdAtUtc, value);
    }

    public DateTime UpdatedAtUtc
    {
        get => _updatedAtUtc;
        set => SetPropertyValue(nameof(UpdatedAtUtc), ref _updatedAtUtc, value);
    }

    [DisplayName("Макс. получателей за запуск")]
    public int MaxRecipientsPerRun
    {
        get => _maxRecipientsPerRun;
        set => SetPropertyValue(nameof(MaxRecipientsPerRun), ref _maxRecipientsPerRun, value);
    }

    public int MaxAttempts
    {
        get => _maxAttempts;
        set => SetPropertyValue(nameof(MaxAttempts), ref _maxAttempts, value);
    }

    public bool UseOrgPrimaryEmail
    {
        get => _useOrgPrimaryEmail;
        set => SetPropertyValue(nameof(UseOrgPrimaryEmail), ref _useOrgPrimaryEmail, value);
    }

    public bool UseContactEmails
    {
        get => _useContactEmails;
        set => SetPropertyValue(nameof(UseContactEmails), ref _useContactEmails, value);
    }

    public bool UseSalaryEmail
    {
        get => _useSalaryEmail;
        set => SetPropertyValue(nameof(UseSalaryEmail), ref _useSalaryEmail, value);
    }

    public bool UseOneCEmail
    {
        get => _useOneCEmail;
        set => SetPropertyValue(nameof(UseOneCEmail), ref _useOneCEmail, value);
    }

    public bool UseSiteEmail
    {
        get => _useSiteEmail;
        set => SetPropertyValue(nameof(UseSiteEmail), ref _useSiteEmail, value);
    }

    public bool UseDirectorEmail
    {
        get => _useDirectorEmail;
        set => SetPropertyValue(nameof(UseDirectorEmail), ref _useDirectorEmail, value);
    }

    [Size(SizeAttribute.Unlimited)]
    public string? ManualRecipientsCsv
    {
        get => _manualRecipientsCsv;
        set => SetPropertyValue(nameof(ManualRecipientsCsv), ref _manualRecipientsCsv, value);
    }

    [Association("Campaign-Organizations")]
    public XPCollection<MailCampaignTargetOrganization> TargetOrganizations => GetCollection<MailCampaignTargetOrganization>(nameof(TargetOrganizations));

    [Association("Campaign-Attachments")]
    public XPCollection<MailCampaignAttachment> Attachments => GetCollection<MailCampaignAttachment>(nameof(Attachments));

    [Association("Campaign-Batches")]
    public XPCollection<MailDispatchBatch> Batches => GetCollection<MailDispatchBatch>(nameof(Batches));
}

[Persistent("MailCampaignTargetOrganization")]
public class MailCampaignTargetOrganization(Session session) : XPObject(session)
{
    private MailCampaign? _campaign;
    private int _legacyOrgId;
    private string? _legacyOrgName;
    private string? _legacyRaionName;

    public MailCampaignTargetOrganization() : this(Session.DefaultSession) { }

    [Association("Campaign-Organizations")]
    public MailCampaign? Campaign
    {
        get => _campaign;
        set => SetPropertyValue(nameof(Campaign), ref _campaign, value);
    }

    public int LegacyOrgId
    {
        get => _legacyOrgId;
        set => SetPropertyValue(nameof(LegacyOrgId), ref _legacyOrgId, value);
    }

    [Size(512)]
    public string? LegacyOrgName
    {
        get => _legacyOrgName;
        set => SetPropertyValue(nameof(LegacyOrgName), ref _legacyOrgName, value);
    }

    [Size(256)]
    public string? LegacyRaionName
    {
        get => _legacyRaionName;
        set => SetPropertyValue(nameof(LegacyRaionName), ref _legacyRaionName, value);
    }
}

[Persistent("MailStoredFile")]
public class MailStoredFile(Session session) : XPObject(session)
{
    private string? _originalFileName;
    private string? _storedFileName;
    private string? _relativePath;
    private string? _contentType;
    private long _length;
    private string? _sha256;
    private bool _isPublic;
    private int _uploadedByLegacyUserId;
    private DateTime _uploadedAtUtc;

    public MailStoredFile() : this(Session.DefaultSession) { }

    [Size(512)]
    public string? OriginalFileName
    {
        get => _originalFileName;
        set => SetPropertyValue(nameof(OriginalFileName), ref _originalFileName, value);
    }

    [Size(512)]
    public string? StoredFileName
    {
        get => _storedFileName;
        set => SetPropertyValue(nameof(StoredFileName), ref _storedFileName, value);
    }

    [Size(1024)]
    public string? RelativePath
    {
        get => _relativePath;
        set => SetPropertyValue(nameof(RelativePath), ref _relativePath, value);
    }

    [Size(256)]
    public string? ContentType
    {
        get => _contentType;
        set => SetPropertyValue(nameof(ContentType), ref _contentType, value);
    }

    public long Length
    {
        get => _length;
        set => SetPropertyValue(nameof(Length), ref _length, value);
    }

    [Size(256)]
    public string? Sha256
    {
        get => _sha256;
        set => SetPropertyValue(nameof(Sha256), ref _sha256, value);
    }

    public bool IsPublic
    {
        get => _isPublic;
        set => SetPropertyValue(nameof(IsPublic), ref _isPublic, value);
    }

    public int UploadedByLegacyUserId
    {
        get => _uploadedByLegacyUserId;
        set => SetPropertyValue(nameof(UploadedByLegacyUserId), ref _uploadedByLegacyUserId, value);
    }

    public DateTime UploadedAtUtc
    {
        get => _uploadedAtUtc;
        set => SetPropertyValue(nameof(UploadedAtUtc), ref _uploadedAtUtc, value);
    }

    [Association("StoredFile-CampaignAttachments")]
    public XPCollection<MailCampaignAttachment> CampaignAttachments => GetCollection<MailCampaignAttachment>(nameof(CampaignAttachments));
}

[Persistent("MailCampaignAttachment")]
public class MailCampaignAttachment(Session session) : XPObject(session)
{
    private MailCampaign? _campaign;
    private MailStoredFile? _storedFile;
    private AttachmentKind _attachmentKind;
    private string? _displayName;
    private string? _contentId;
    private int _sortOrder;

    public MailCampaignAttachment() : this(Session.DefaultSession) { }

    [Association("Campaign-Attachments")]
    public MailCampaign? Campaign
    {
        get => _campaign;
        set => SetPropertyValue(nameof(Campaign), ref _campaign, value);
    }

    [Association("StoredFile-CampaignAttachments")]
    public MailStoredFile? StoredFile
    {
        get => _storedFile;
        set => SetPropertyValue(nameof(StoredFile), ref _storedFile, value);
    }

    public AttachmentKind AttachmentKind
    {
        get => _attachmentKind;
        set => SetPropertyValue(nameof(AttachmentKind), ref _attachmentKind, value);
    }

    [Size(512)]
    public string? DisplayName
    {
        get => _displayName;
        set => SetPropertyValue(nameof(DisplayName), ref _displayName, value);
    }

    [Size(256)]
    public string? ContentId
    {
        get => _contentId;
        set => SetPropertyValue(nameof(ContentId), ref _contentId, value);
    }

    public int SortOrder
    {
        get => _sortOrder;
        set => SetPropertyValue(nameof(SortOrder), ref _sortOrder, value);
    }
}

[Persistent("MailDispatchBatch")]
public class MailDispatchBatch(Session session) : XPObject(session)
{
    private MailCampaign? _campaign;
    private DispatchTriggerKind _triggerKind;
    private string? _triggerComment;
    private DateTime _scheduledAtUtc;
    private DateTime _createdAtUtc;
    private DateTime _completedAtUtc;
    private int _totalRecipients;
    private int _queuedCount;
    private int _processingCount;
    private int _sentCount;
    private int _failedCount;
    private int _cancelledCount;
    private string? _correlationId;

    public MailDispatchBatch() : this(Session.DefaultSession) { }

    [Association("Campaign-Batches")]
    public MailCampaign? Campaign
    {
        get => _campaign;
        set => SetPropertyValue(nameof(Campaign), ref _campaign, value);
    }

    public DispatchTriggerKind TriggerKind
    {
        get => _triggerKind;
        set => SetPropertyValue(nameof(TriggerKind), ref _triggerKind, value);
    }

    [Size(1000)]
    public string? TriggerComment
    {
        get => _triggerComment;
        set => SetPropertyValue(nameof(TriggerComment), ref _triggerComment, value);
    }

    public DateTime ScheduledAtUtc
    {
        get => _scheduledAtUtc;
        set => SetPropertyValue(nameof(ScheduledAtUtc), ref _scheduledAtUtc, value);
    }

    public DateTime CreatedAtUtc
    {
        get => _createdAtUtc;
        set => SetPropertyValue(nameof(CreatedAtUtc), ref _createdAtUtc, value);
    }

    public DateTime CompletedAtUtc
    {
        get => _completedAtUtc;
        set => SetPropertyValue(nameof(CompletedAtUtc), ref _completedAtUtc, value);
    }

    public int TotalRecipients
    {
        get => _totalRecipients;
        set => SetPropertyValue(nameof(TotalRecipients), ref _totalRecipients, value);
    }

    public int QueuedCount
    {
        get => _queuedCount;
        set => SetPropertyValue(nameof(QueuedCount), ref _queuedCount, value);
    }

    public int ProcessingCount
    {
        get => _processingCount;
        set => SetPropertyValue(nameof(ProcessingCount), ref _processingCount, value);
    }

    public int SentCount
    {
        get => _sentCount;
        set => SetPropertyValue(nameof(SentCount), ref _sentCount, value);
    }

    public int FailedCount
    {
        get => _failedCount;
        set => SetPropertyValue(nameof(FailedCount), ref _failedCount, value);
    }

    public int CancelledCount
    {
        get => _cancelledCount;
        set => SetPropertyValue(nameof(CancelledCount), ref _cancelledCount, value);
    }

    [Size(128)]
    public string? CorrelationId
    {
        get => _correlationId;
        set => SetPropertyValue(nameof(CorrelationId), ref _correlationId, value);
    }

    [Association("Batch-Items")]
    public XPCollection<MailDispatchItem> Items => GetCollection<MailDispatchItem>(nameof(Items));
}

[Persistent("MailDispatchItem")]
public class MailDispatchItem(Session session) : XPObject(session)
{
    private MailDispatchBatch? _batch;
    private MailCampaign? _campaign;
    private int _legacyOrgId;
    private string? _legacyOrgName;
    private string? _recipientEmail;
    private string? _recipientDisplayName;
    private RecipientSourceKind _sourceKind;
    private DispatchStatus _status;
    private int _attemptCount;
    private DateTime _queuedAtUtc;
    private DateTime _channelQueuedAtUtc;
    private DateTime _startedAtUtc;
    private DateTime _sentAtUtc;
    private DateTime _failedAtUtc;
    private DateTime _nextAttemptAtUtc;
    private string? _errorMessage;
    private string? _smtpResponse;
    private string? _messageId;
    private string? _workerNode;
    private string? _dispatchKey;

    public MailDispatchItem() : this(Session.DefaultSession) { }

    [Association("Batch-Items")]
    public MailDispatchBatch? Batch
    {
        get => _batch;
        set => SetPropertyValue(nameof(Batch), ref _batch, value);
    }

    public MailCampaign? Campaign
    {
        get => _campaign;
        set => SetPropertyValue(nameof(Campaign), ref _campaign, value);
    }

    public int LegacyOrgId
    {
        get => _legacyOrgId;
        set => SetPropertyValue(nameof(LegacyOrgId), ref _legacyOrgId, value);
    }

    [Size(512)]
    public string? LegacyOrgName
    {
        get => _legacyOrgName;
        set => SetPropertyValue(nameof(LegacyOrgName), ref _legacyOrgName, value);
    }

    [Size(512)]
    public string? RecipientEmail
    {
        get => _recipientEmail;
        set => SetPropertyValue(nameof(RecipientEmail), ref _recipientEmail, value);
    }

    [Size(256)]
    public string? RecipientDisplayName
    {
        get => _recipientDisplayName;
        set => SetPropertyValue(nameof(RecipientDisplayName), ref _recipientDisplayName, value);
    }

    public RecipientSourceKind SourceKind
    {
        get => _sourceKind;
        set => SetPropertyValue(nameof(SourceKind), ref _sourceKind, value);
    }

    public DispatchStatus Status
    {
        get => _status;
        set => SetPropertyValue(nameof(Status), ref _status, value);
    }

    public int AttemptCount
    {
        get => _attemptCount;
        set => SetPropertyValue(nameof(AttemptCount), ref _attemptCount, value);
    }

    public DateTime QueuedAtUtc
    {
        get => _queuedAtUtc;
        set => SetPropertyValue(nameof(QueuedAtUtc), ref _queuedAtUtc, value);
    }

    public DateTime ChannelQueuedAtUtc
    {
        get => _channelQueuedAtUtc;
        set => SetPropertyValue(nameof(ChannelQueuedAtUtc), ref _channelQueuedAtUtc, value);
    }

    public DateTime StartedAtUtc
    {
        get => _startedAtUtc;
        set => SetPropertyValue(nameof(StartedAtUtc), ref _startedAtUtc, value);
    }

    public DateTime SentAtUtc
    {
        get => _sentAtUtc;
        set => SetPropertyValue(nameof(SentAtUtc), ref _sentAtUtc, value);
    }

    public DateTime FailedAtUtc
    {
        get => _failedAtUtc;
        set => SetPropertyValue(nameof(FailedAtUtc), ref _failedAtUtc, value);
    }

    public DateTime NextAttemptAtUtc
    {
        get => _nextAttemptAtUtc;
        set => SetPropertyValue(nameof(NextAttemptAtUtc), ref _nextAttemptAtUtc, value);
    }

    [Size(4000)]
    public string? ErrorMessage
    {
        get => _errorMessage;
        set => SetPropertyValue(nameof(ErrorMessage), ref _errorMessage, value);
    }

    [Size(1000)]
    public string? SmtpResponse
    {
        get => _smtpResponse;
        set => SetPropertyValue(nameof(SmtpResponse), ref _smtpResponse, value);
    }

    [Size(1000)]
    public string? MessageId
    {
        get => _messageId;
        set => SetPropertyValue(nameof(MessageId), ref _messageId, value);
    }

    [Size(128)]
    public string? WorkerNode
    {
        get => _workerNode;
        set => SetPropertyValue(nameof(WorkerNode), ref _workerNode, value);
    }

    [Size(512)]
    public string? DispatchKey
    {
        get => _dispatchKey;
        set => SetPropertyValue(nameof(DispatchKey), ref _dispatchKey, value);
    }
}
