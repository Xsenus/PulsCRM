using System.ComponentModel;
using System.Security.Cryptography;
using System.Text;
using DevExpress.Xpo;
using DisplayName = System.ComponentModel.DisplayNameAttribute;

namespace PulsNext.Domain.Legacy;

public static class LegacyPersistentTypes
{
    public static readonly Type[] All =
    {
        typeof(LegacyUser),
        typeof(LegacyUserInfo),
        typeof(LegacyUserGroup),
        typeof(LegacyRule),
        typeof(LegacyPrivacyGroup),
        typeof(LegacyTask),
        typeof(LegacyRaion),
        typeof(LegacyOrgType),
        typeof(LegacyOrg),
        typeof(LegacyOrgInfo),
        typeof(LegacyOrgInfoOther),
        typeof(LegacyContact),
        typeof(LegacyJob),
        typeof(LegacySprEnumeration)
    };
}

public static class LegacyPasswordHasher
{
    public static string HashUnicodeMd5(string value)
    {
        ArgumentNullException.ThrowIfNull(value);
        var bytes = Encoding.Unicode.GetBytes(value);
        using var md5 = MD5.Create();
        var hash = md5.ComputeHash(bytes);
        var builder = new StringBuilder(hash.Length * 2);
        foreach (var b in hash)
        {
            builder.Append(b.ToString("x2"));
        }

        return builder.ToString();
    }
}

[Persistent("set_User")]
public class LegacyUser(Session session) : XPObject(session)
{
    private string? _gId;
    private int _index;
    private int _imageIndex;
    private string? _name;
    private string? _password;
    private string? _fullName;
    private bool _maleFemale;
    private bool _flRoot;
    private int _ruleSimple;
    private LegacyRule? _rule;
    private LegacyUserInfo? _userInfo;
    private LegacyUserGroup? _userGroup;
    private LegacyPrivacyGroup? _privacyGroup;

    public LegacyUser() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId
    {
        get => _gId;
        set => SetPropertyValue(nameof(GId), ref _gId, value);
    }

    public int Index
    {
        get => _index;
        set => SetPropertyValue(nameof(Index), ref _index, value);
    }

    public int ImageIndex
    {
        get => _imageIndex;
        set => SetPropertyValue(nameof(ImageIndex), ref _imageIndex, value);
    }

    [DisplayName("Имя")]
    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    [DisplayName("Пароль")]
    public string? Password
    {
        get => _password;
        set => SetPropertyValue(nameof(Password), ref _password, value);
    }

    [Size(254)]
    [DisplayName("Полное имя")]
    public string? FullName
    {
        get => _fullName;
        set => SetPropertyValue(nameof(FullName), ref _fullName, value);
    }

    public bool MaleFemale
    {
        get => _maleFemale;
        set => SetPropertyValue(nameof(MaleFemale), ref _maleFemale, value);
    }

    public bool FlRoot
    {
        get => _flRoot;
        set => SetPropertyValue(nameof(FlRoot), ref _flRoot, value);
    }

    public int RuleSimple
    {
        get => _ruleSimple;
        set => SetPropertyValue(nameof(RuleSimple), ref _ruleSimple, value);
    }

    public LegacyRule? Rule
    {
        get => _rule;
        set => SetPropertyValue(nameof(Rule), ref _rule, value);
    }

    public LegacyUserInfo? UserInfo
    {
        get => _userInfo;
        set => SetPropertyValue(nameof(UserInfo), ref _userInfo, value);
    }

    [Association("User-Group")]
    public LegacyUserGroup? UserGroup
    {
        get => _userGroup;
        set => SetPropertyValue(nameof(UserGroup), ref _userGroup, value);
    }

    public LegacyPrivacyGroup? PrivacyGroup
    {
        get => _privacyGroup;
        set => SetPropertyValue(nameof(PrivacyGroup), ref _privacyGroup, value);
    }

    public override string ToString() => FullName ?? Name ?? $"User#{Oid}";
}

[Persistent("set_UserInfo")]
public class LegacyUserInfo(Session session) : XPObject(session)
{
    private string? _comment;
    private DateTime _birthDay;
    private string? _dolgnost;
    private string? _email;
    private string? _site;
    private string? _address;
    private string? _phone;
    private string? _phoneWorkRedirect;
    private string? _icq;
    private string? _skype;
    private string? _s1cCode;
    private byte[]? _avatar;
    private byte[]? _photo;
    private LegacyUser? _user;

    public LegacyUserInfo() : this(Session.DefaultSession) { }

    [Size(2000)]
    public string? Comment
    {
        get => _comment;
        set => SetPropertyValue(nameof(Comment), ref _comment, value);
    }

    public DateTime BirthDay
    {
        get => _birthDay;
        set => SetPropertyValue(nameof(BirthDay), ref _birthDay, value);
    }

    public string? Dolgnost
    {
        get => _dolgnost;
        set => SetPropertyValue(nameof(Dolgnost), ref _dolgnost, value);
    }

    public string? Email
    {
        get => _email;
        set => SetPropertyValue(nameof(Email), ref _email, value);
    }

    public string? Site
    {
        get => _site;
        set => SetPropertyValue(nameof(Site), ref _site, value);
    }

    public string? Address
    {
        get => _address;
        set => SetPropertyValue(nameof(Address), ref _address, value);
    }

    public string? Phone
    {
        get => _phone;
        set => SetPropertyValue(nameof(Phone), ref _phone, value);
    }

    public string? PhoneWorkRedirect
    {
        get => _phoneWorkRedirect;
        set => SetPropertyValue(nameof(PhoneWorkRedirect), ref _phoneWorkRedirect, value);
    }

    public string? ICQ
    {
        get => _icq;
        set => SetPropertyValue(nameof(ICQ), ref _icq, value);
    }

    public string? Skype
    {
        get => _skype;
        set => SetPropertyValue(nameof(Skype), ref _skype, value);
    }

    [Persistent("s_1cCode")]
    public string? S1cCode
    {
        get => _s1cCode;
        set => SetPropertyValue(nameof(S1cCode), ref _s1cCode, value);
    }

    public byte[]? Avatar
    {
        get => _avatar;
        set => SetPropertyValue(nameof(Avatar), ref _avatar, value);
    }

    public byte[]? Photo
    {
        get => _photo;
        set => SetPropertyValue(nameof(Photo), ref _photo, value);
    }

    public LegacyUser? User
    {
        get => _user;
        set => SetPropertyValue(nameof(User), ref _user, value);
    }
}

[Persistent("set_UserGroup")]
public class LegacyUserGroup(Session session) : XPObject(session)
{
    private string? _gId;
    private int _index;
    private int _imageIndex;
    private string? _name;
    private string? _fullName;

    public LegacyUserGroup() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId
    {
        get => _gId;
        set => SetPropertyValue(nameof(GId), ref _gId, value);
    }

    public int Index
    {
        get => _index;
        set => SetPropertyValue(nameof(Index), ref _index, value);
    }

    public int ImageIndex
    {
        get => _imageIndex;
        set => SetPropertyValue(nameof(ImageIndex), ref _imageIndex, value);
    }

    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    [Size(254)]
    public string? FullName
    {
        get => _fullName;
        set => SetPropertyValue(nameof(FullName), ref _fullName, value);
    }

    [Association("User-Group")]
    public XPCollection<LegacyUser> Users => GetCollection<LegacyUser>(nameof(Users));
}

[Persistent("set_Rule")]
public class LegacyRule(Session session) : XPObject(session)
{
    private string? _gId;
    private int _index;
    private int _imageIndex;
    private string? _name;
    private string? _fullName;

    public LegacyRule() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId
    {
        get => _gId;
        set => SetPropertyValue(nameof(GId), ref _gId, value);
    }

    public int Index
    {
        get => _index;
        set => SetPropertyValue(nameof(Index), ref _index, value);
    }

    public int ImageIndex
    {
        get => _imageIndex;
        set => SetPropertyValue(nameof(ImageIndex), ref _imageIndex, value);
    }

    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    [Size(254)]
    public string? FullName
    {
        get => _fullName;
        set => SetPropertyValue(nameof(FullName), ref _fullName, value);
    }
}

[Persistent("set_PrivacyGroup")]
public class LegacyPrivacyGroup(Session session) : XPObject(session)
{
    private string? _name;
    private string? _fullName;

    public LegacyPrivacyGroup() : this(Session.DefaultSession) { }

    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    public string? FullName
    {
        get => _fullName;
        set => SetPropertyValue(nameof(FullName), ref _fullName, value);
    }
}

[Persistent("set_Task")]
public class LegacyTask(Session session) : XPObject(session)
{
    private string? _gId;
    private int _index;
    private int _imageIndex;
    private string? _name;
    private string? _fullName;
    private int _taskVariant;

    public LegacyTask() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId
    {
        get => _gId;
        set => SetPropertyValue(nameof(GId), ref _gId, value);
    }

    public int Index
    {
        get => _index;
        set => SetPropertyValue(nameof(Index), ref _index, value);
    }

    public int ImageIndex
    {
        get => _imageIndex;
        set => SetPropertyValue(nameof(ImageIndex), ref _imageIndex, value);
    }

    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    [Size(254)]
    public string? FullName
    {
        get => _fullName;
        set => SetPropertyValue(nameof(FullName), ref _fullName, value);
    }

    public int TaskVariant
    {
        get => _taskVariant;
        set => SetPropertyValue(nameof(TaskVariant), ref _taskVariant, value);
    }

    public override string ToString() => Name ?? FullName ?? $"Task#{Oid}";
}

[Persistent("set_Raion")]
public class LegacyRaion(Session session) : XPObject(session)
{
    private string? _name;

    public LegacyRaion() : this(Session.DefaultSession) { }

    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    [NonPersistent]
    public string? FullName => Name;

    public override string ToString() => Name ?? $"Raion#{Oid}";
}

[Persistent("set_OrgType")]
public class LegacyOrgType(Session session) : XPObject(session)
{
    private string? _name;
    private string? _fullName;

    public LegacyOrgType() : this(Session.DefaultSession) { }

    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    [Size(254)]
    public string? FullName
    {
        get => _fullName;
        set => SetPropertyValue(nameof(FullName), ref _fullName, value);
    }

    public override string ToString() => FullName ?? Name ?? $"OrgType#{Oid}";
}

[Persistent("set_Org")]
public class LegacyOrg(Session session) : XPObject(session)
{
    private string? _gId;
    private int _index;
    private int _imageIndex;
    private string? _name;
    private string? _smallName;
    private string? _fullName;
    private string? _inn;
    private string? _userNameBusy;
    private LegacyUser? _userCreate;
    private LegacyUser? _userUpdate;
    private DateTime _dateCreate;
    private DateTime _dateUpdate;
    private LegacyUser? _userUpdateAdmin;
    private DateTime _dateUpdateAdmin;
    private LegacyOrgInfo? _orgInfo;
    private LegacyOrgInfoOther? _orgInfoOther;
    private bool _flSelect;
    private bool _flVisible;
    private bool _flManager;
    private LegacyRaion? _raion;
    private LegacyOrgType? _orgType;

    public LegacyOrg() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId
    {
        get => _gId;
        set => SetPropertyValue(nameof(GId), ref _gId, value);
    }

    public int Index
    {
        get => _index;
        set => SetPropertyValue(nameof(Index), ref _index, value);
    }

    public int ImageIndex
    {
        get => _imageIndex;
        set => SetPropertyValue(nameof(ImageIndex), ref _imageIndex, value);
    }

    [Size(254)]
    [DisplayName("Наименование")]
    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    [Size(254)]
    [DisplayName("Короткое наименование")]
    public string? SmallName
    {
        get => _smallName;
        set => SetPropertyValue(nameof(SmallName), ref _smallName, value);
    }

    [Size(500)]
    [DisplayName("Полное наименование")]
    public string? FullName
    {
        get => _fullName;
        set => SetPropertyValue(nameof(FullName), ref _fullName, value);
    }

    [DisplayName("ИНН")]
    public string? INN
    {
        get => _inn;
        set => SetPropertyValue(nameof(INN), ref _inn, value);
    }

    public string? UserName_busy
    {
        get => _userNameBusy;
        set => SetPropertyValue(nameof(UserName_busy), ref _userNameBusy, value);
    }

    public LegacyUser? User_create
    {
        get => _userCreate;
        set => SetPropertyValue(nameof(User_create), ref _userCreate, value);
    }

    public LegacyUser? User_update
    {
        get => _userUpdate;
        set => SetPropertyValue(nameof(User_update), ref _userUpdate, value);
    }

    public DateTime Date_create
    {
        get => _dateCreate;
        set => SetPropertyValue(nameof(Date_create), ref _dateCreate, value);
    }

    public DateTime Date_update
    {
        get => _dateUpdate;
        set => SetPropertyValue(nameof(Date_update), ref _dateUpdate, value);
    }

    public LegacyUser? User_update_admin
    {
        get => _userUpdateAdmin;
        set => SetPropertyValue(nameof(User_update_admin), ref _userUpdateAdmin, value);
    }

    public DateTime Date_update_admin
    {
        get => _dateUpdateAdmin;
        set => SetPropertyValue(nameof(Date_update_admin), ref _dateUpdateAdmin, value);
    }

    public LegacyOrgInfo? OrgInfo
    {
        get => _orgInfo;
        set => SetPropertyValue(nameof(OrgInfo), ref _orgInfo, value);
    }

    public LegacyOrgInfoOther? OrgInfoOther
    {
        get => _orgInfoOther;
        set => SetPropertyValue(nameof(OrgInfoOther), ref _orgInfoOther, value);
    }

    public bool fl_select
    {
        get => _flSelect;
        set => SetPropertyValue(nameof(fl_select), ref _flSelect, value);
    }

    [Persistent("fl_visible")]
    public bool FlVisible
    {
        get => _flVisible;
        set => SetPropertyValue(nameof(FlVisible), ref _flVisible, value);
    }

    [Persistent("fl_manager")]
    public bool FlManager
    {
        get => _flManager;
        set => SetPropertyValue(nameof(FlManager), ref _flManager, value);
    }

    public LegacyRaion? Raion
    {
        get => _raion;
        set => SetPropertyValue(nameof(Raion), ref _raion, value);
    }

    public LegacyOrgType? OrgType
    {
        get => _orgType;
        set => SetPropertyValue(nameof(OrgType), ref _orgType, value);
    }

    [Association("Org-Contact")]
    public XPCollection<LegacyContact> Contacts => GetCollection<LegacyContact>(nameof(Contacts));

    public override string ToString() => Name ?? FullName ?? $"Org#{Oid}";
}

[Persistent("set_OrgInfo")]
public class LegacyOrgInfo(Session session) : XPObject(session)
{
    private string? _comment;
    private string? _otherInfo;
    private string? _kpp;
    private string? _addressU;
    private string? _addressF;
    private string? _phone;
    private string? _email;
    private string? _site;
    private double _summaDolga;
    private double _summaDolgaActual;
    private double _summaDolgaMinus6;
    private LegacyOrg? _org;

    public LegacyOrgInfo() : this(Session.DefaultSession) { }

    [Size(2000)]
    public string? Comment
    {
        get => _comment;
        set => SetPropertyValue(nameof(Comment), ref _comment, value);
    }

    [Size(2000)]
    public string? OtherInfo
    {
        get => _otherInfo;
        set => SetPropertyValue(nameof(OtherInfo), ref _otherInfo, value);
    }

    public string? KPP
    {
        get => _kpp;
        set => SetPropertyValue(nameof(KPP), ref _kpp, value);
    }

    [Size(254)]
    public string? AddressU
    {
        get => _addressU;
        set => SetPropertyValue(nameof(AddressU), ref _addressU, value);
    }

    [Size(254)]
    public string? AddressF
    {
        get => _addressF;
        set => SetPropertyValue(nameof(AddressF), ref _addressF, value);
    }

    public string? Phone
    {
        get => _phone;
        set => SetPropertyValue(nameof(Phone), ref _phone, value);
    }

    public string? Email
    {
        get => _email;
        set => SetPropertyValue(nameof(Email), ref _email, value);
    }

    public string? Site
    {
        get => _site;
        set => SetPropertyValue(nameof(Site), ref _site, value);
    }

    public double SummaDolga
    {
        get => _summaDolga;
        set => SetPropertyValue(nameof(SummaDolga), ref _summaDolga, value);
    }

    public double SummaDolgaActual
    {
        get => _summaDolgaActual;
        set => SetPropertyValue(nameof(SummaDolgaActual), ref _summaDolgaActual, value);
    }

    public double SummaDolgaMinus6
    {
        get => _summaDolgaMinus6;
        set => SetPropertyValue(nameof(SummaDolgaMinus6), ref _summaDolgaMinus6, value);
    }

    public LegacyOrg? Org
    {
        get => _org;
        set => SetPropertyValue(nameof(Org), ref _org, value);
    }
}

[Persistent("set_OrgInfoOther")]
public class LegacyOrgInfoOther(Session session) : XPObject(session)
{
    private string? _ogrn;
    private string? _rukEmail;
    private string? _zpEmail;
    private string? _f1cEmail;
    private string? _siteEmail;
    private bool _zpWorking;
    private bool _f1cWorkingB;
    private bool _f1cWorkingZ;
    private bool _f1cWorkingJkh;
    private string? _zpPhone;
    private string? _zpFio;
    private string? _f1cPhone;
    private string? _f1cFio;
    private string? _sitePhone;
    private string? _siteFio;
    private LegacyOrg? _org;

    public LegacyOrgInfoOther() : this(Session.DefaultSession) { }

    [DisplayName("ОГРН")]
    public string? OGRN
    {
        get => _ogrn;
        set => SetPropertyValue(nameof(OGRN), ref _ogrn, value);
    }

    public string? RukEmail
    {
        get => _rukEmail;
        set => SetPropertyValue(nameof(RukEmail), ref _rukEmail, value);
    }

    [DisplayName("Email ЗП")]
    public string? ZpEmail
    {
        get => _zpEmail;
        set => SetPropertyValue(nameof(ZpEmail), ref _zpEmail, value);
    }

    [DisplayName("Email 1C")]
    public string? F1cEmail
    {
        get => _f1cEmail;
        set => SetPropertyValue(nameof(F1cEmail), ref _f1cEmail, value);
    }

    public string? SiteEmail
    {
        get => _siteEmail;
        set => SetPropertyValue(nameof(SiteEmail), ref _siteEmail, value);
    }

    public bool ZpWorking
    {
        get => _zpWorking;
        set => SetPropertyValue(nameof(ZpWorking), ref _zpWorking, value);
    }

    public bool F1cWorkingB
    {
        get => _f1cWorkingB;
        set => SetPropertyValue(nameof(F1cWorkingB), ref _f1cWorkingB, value);
    }

    public bool F1cWorkingZ
    {
        get => _f1cWorkingZ;
        set => SetPropertyValue(nameof(F1cWorkingZ), ref _f1cWorkingZ, value);
    }

    [Persistent("F1cWorkingJKH")]
    public bool F1cWorkingJKH
    {
        get => _f1cWorkingJkh;
        set => SetPropertyValue(nameof(F1cWorkingJKH), ref _f1cWorkingJkh, value);
    }

    public string? ZpPhone
    {
        get => _zpPhone;
        set => SetPropertyValue(nameof(ZpPhone), ref _zpPhone, value);
    }

    public string? ZpFIO
    {
        get => _zpFio;
        set => SetPropertyValue(nameof(ZpFIO), ref _zpFio, value);
    }

    public string? F1cPhone
    {
        get => _f1cPhone;
        set => SetPropertyValue(nameof(F1cPhone), ref _f1cPhone, value);
    }

    public string? F1cFIO
    {
        get => _f1cFio;
        set => SetPropertyValue(nameof(F1cFIO), ref _f1cFio, value);
    }

    public string? SitePhone
    {
        get => _sitePhone;
        set => SetPropertyValue(nameof(SitePhone), ref _sitePhone, value);
    }

    public string? SiteFIO
    {
        get => _siteFio;
        set => SetPropertyValue(nameof(SiteFIO), ref _siteFio, value);
    }

    public LegacyOrg? Org
    {
        get => _org;
        set => SetPropertyValue(nameof(Org), ref _org, value);
    }
}

[Persistent("set_Contact")]
public class LegacyContact(Session session) : XPObject(session)
{
    private string? _fio;
    private string? _phone;
    private string? _email;
    private string? _comment;
    private LegacyUser? _userCreate;
    private LegacyUser? _userUpdate;
    private DateTime _dateCreate;
    private DateTime _dateUpdate;
    private LegacySprEnumeration? _enDolgnost;
    private LegacySprEnumeration? _group;
    private LegacySprEnumeration? _status;
    private LegacyOrg? _org;

    public LegacyContact() : this(Session.DefaultSession) { }

    public string? FIO
    {
        get => _fio;
        set => SetPropertyValue(nameof(FIO), ref _fio, value);
    }

    public string? Phone
    {
        get => _phone;
        set => SetPropertyValue(nameof(Phone), ref _phone, value);
    }

    public string? Email
    {
        get => _email;
        set => SetPropertyValue(nameof(Email), ref _email, value);
    }

    [Size(500)]
    public string? Comment
    {
        get => _comment;
        set => SetPropertyValue(nameof(Comment), ref _comment, value);
    }

    public LegacyUser? User_create
    {
        get => _userCreate;
        set => SetPropertyValue(nameof(User_create), ref _userCreate, value);
    }

    public LegacyUser? User_update
    {
        get => _userUpdate;
        set => SetPropertyValue(nameof(User_update), ref _userUpdate, value);
    }

    public DateTime Date_create
    {
        get => _dateCreate;
        set => SetPropertyValue(nameof(Date_create), ref _dateCreate, value);
    }

    public DateTime Date_update
    {
        get => _dateUpdate;
        set => SetPropertyValue(nameof(Date_update), ref _dateUpdate, value);
    }

    public LegacySprEnumeration? EnDolgnost
    {
        get => _enDolgnost;
        set => SetPropertyValue(nameof(EnDolgnost), ref _enDolgnost, value);
    }

    public LegacySprEnumeration? Group
    {
        get => _group;
        set => SetPropertyValue(nameof(Group), ref _group, value);
    }

    public LegacySprEnumeration? Status
    {
        get => _status;
        set => SetPropertyValue(nameof(Status), ref _status, value);
    }

    [Association("Org-Contact")]
    public LegacyOrg? Org
    {
        get => _org;
        set => SetPropertyValue(nameof(Org), ref _org, value);
    }

    public override string ToString() => FIO ?? Email ?? $"Contact#{Oid}";
}

[Persistent("set_SprEnumeration")]
public class LegacySprEnumeration(Session session) : XPObject(session)
{
    private int _imageIndex;
    private string? _name;
    private string? _fullName;
    private int _group;
    private bool _flDef;

    public LegacySprEnumeration() : this(Session.DefaultSession) { }

    [NonPersistent]
    public int Index
    {
        get;
        set;
    }

    public int ImageIndex
    {
        get => _imageIndex;
        set => SetPropertyValue(nameof(ImageIndex), ref _imageIndex, value);
    }

    public string? Name
    {
        get => _name;
        set => SetPropertyValue(nameof(Name), ref _name, value);
    }

    public string? FullName
    {
        get => _fullName;
        set => SetPropertyValue(nameof(FullName), ref _fullName, value);
    }

    public int Group
    {
        get => _group;
        set => SetPropertyValue(nameof(Group), ref _group, value);
    }

    [Persistent("fl_def")]
    public bool FlDef
    {
        get => _flDef;
        set => SetPropertyValue(nameof(FlDef), ref _flDef, value);
    }

    public override string ToString() => Name ?? FullName ?? $"Spr#{Oid}";
}

[Persistent("set_Job")]
public class LegacyJob(Session session) : XPObject(session)
{
    private LegacyUser? _userFrom;
    private LegacyUser? _userTo;
    private LegacySprEnumeration? _categoryJob;
    private LegacyTask? _task;
    private LegacyOrg? _org;
    private DateTime _dateCreate;
    private DateTime _dateFrom;
    private DateTime _dateTo;
    private DateTime _dateCompleted;
    private string? _message;
    private string? _comment;

    public LegacyJob() : this(Session.DefaultSession) { }

    public LegacyUser? UserFrom
    {
        get => _userFrom;
        set => SetPropertyValue(nameof(UserFrom), ref _userFrom, value);
    }

    public LegacyUser? UserTo
    {
        get => _userTo;
        set => SetPropertyValue(nameof(UserTo), ref _userTo, value);
    }

    public LegacySprEnumeration? CategoryJob
    {
        get => _categoryJob;
        set => SetPropertyValue(nameof(CategoryJob), ref _categoryJob, value);
    }

    public LegacyTask? Task
    {
        get => _task;
        set => SetPropertyValue(nameof(Task), ref _task, value);
    }

    public LegacyOrg? Org
    {
        get => _org;
        set => SetPropertyValue(nameof(Org), ref _org, value);
    }

    public DateTime Date_create
    {
        get => _dateCreate;
        set => SetPropertyValue(nameof(Date_create), ref _dateCreate, value);
    }

    public DateTime DateFrom
    {
        get => _dateFrom;
        set => SetPropertyValue(nameof(DateFrom), ref _dateFrom, value);
    }

    public DateTime DateTo
    {
        get => _dateTo;
        set => SetPropertyValue(nameof(DateTo), ref _dateTo, value);
    }

    public DateTime DateCompleted
    {
        get => _dateCompleted;
        set => SetPropertyValue(nameof(DateCompleted), ref _dateCompleted, value);
    }

    [Size(1000)]
    public string? Message
    {
        get => _message;
        set => SetPropertyValue(nameof(Message), ref _message, value);
    }

    [Size(1000)]
    public string? Comment
    {
        get => _comment;
        set => SetPropertyValue(nameof(Comment), ref _comment, value);
    }
}
