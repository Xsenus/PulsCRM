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
        typeof(LegacyOrgVariant),
        typeof(LegacyWhatToDo),
        typeof(LegacyOrg),
        typeof(LegacyOrgInfo),
        typeof(LegacyOrgInfo1C),
        typeof(LegacyOrgInfoOther),
        typeof(LegacyCategoryInfoTask),
        typeof(LegacyInfoTask),
        typeof(LegacyCategoryOrgEvent),
        typeof(LegacyOrgEvent),
        typeof(PulsPlusSpace.set_OrgEventInfo),
        typeof(PulsPlusSpace.set_OrgEventInfo_Zvonok),
        typeof(PulsPlusSpace.set_OrgEventInfo_Journal),
        typeof(PulsPlusSpace.set_OrgEventInfo_Coming),
        typeof(PulsPlusSpace.set_OrgEventInfo_Turnout),
        typeof(PulsPlusSpace.set_OrgEventInfo_Licenz),
        typeof(PulsPlusSpace.set_OrgEventInfo_RingJur),
        typeof(PulsPlusSpace.set_OrgEventInfo_Oplata),
        typeof(PulsPlusSpace.set_OrgEventInfo_Note),
        typeof(LegacyZPParusLicenseInfo),
        typeof(LegacyZPParusOrder),
        typeof(LegacyFileType),
        typeof(LegacyAttachDocumentType),
        typeof(LegacyAttachDocument),
        typeof(LegacyOrgDocumentStatus),
        typeof(LegacyOrgDogovorPersonal),
        typeof(LegacyOrgRealizDocs),
        typeof(LegacyDogovor),
        typeof(LegacyContact),
        typeof(LegacyJob),
        typeof(LegacySprEnumeration),
        typeof(LegacySprBank)
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

    [Association("User-Raion")]
    public XPCollection<LegacyRaion> Raions => GetCollection<LegacyRaion>(nameof(Raions));

    [Association("User-Task")]
    public XPCollection<LegacyTask> Tasks => GetCollection<LegacyTask>(nameof(Tasks));

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
    private int _imageIndex;
    private string? _name;
    private string? _fullName;
    private bool _flDefault;
    private int _privacyVariant;

    public LegacyPrivacyGroup() : this(Session.DefaultSession) { }

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

    [Persistent("fl_def")]
    public bool FlDefault
    {
        get => _flDefault;
        set => SetPropertyValue(nameof(FlDefault), ref _flDefault, value);
    }

    public int PrivacyVariant
    {
        get => _privacyVariant;
        set => SetPropertyValue(nameof(PrivacyVariant), ref _privacyVariant, value);
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

    [Association("Org-Task")]
    public XPCollection<LegacyOrg> Orgs => GetCollection<LegacyOrg>(nameof(Orgs));

    [Association("User-Task")]
    public XPCollection<LegacyUser> Users => GetCollection<LegacyUser>(nameof(Users));

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

    [Association("User-Raion")]
    public XPCollection<LegacyUser> Users => GetCollection<LegacyUser>(nameof(Users));

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

[Persistent("set_OrgVariant")]
public class LegacyOrgVariant(Session session) : XPObject(session)
{
    private string? _name;
    private string? _fullName;

    public LegacyOrgVariant() : this(Session.DefaultSession) { }

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

    public override string ToString() => FullName ?? Name ?? $"OrgVariant#{Oid}";
}

[Persistent("set_WhatToDo")]
public class LegacyWhatToDo(Session session) : XPObject(session)
{
    private string? _name;
    private string? _fullName;
    private bool _enabled;
    private bool _default;

    public LegacyWhatToDo() : this(Session.DefaultSession) { }

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

    [Persistent("fl_enable")]
    public bool FlEnable
    {
        get => _enabled;
        set => SetPropertyValue(nameof(FlEnable), ref _enabled, value);
    }

    [Persistent("fl_def")]
    public bool FlDefault
    {
        get => _default;
        set => SetPropertyValue(nameof(FlDefault), ref _default, value);
    }

    public override string ToString() => FullName ?? Name ?? $"WhatToDo#{Oid}";
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
    private LegacyOrgInfo1C? _orgInfo1C;
    private LegacyOrgInfoOther? _orgInfoOther;
    private bool _flSelect;
    private bool _flVisible;
    private bool _flManager;
    private LegacyRaion? _raion;
    private LegacyOrgType? _orgType;
    private LegacyOrgVariant? _orgVariant;
    private LegacyWhatToDo? _whatToDo;

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

    public LegacyOrgInfo1C? OrgInfo1C
    {
        get => _orgInfo1C;
        set => SetPropertyValue(nameof(OrgInfo1C), ref _orgInfo1C, value);
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

    public LegacyOrgVariant? OrgVariant
    {
        get => _orgVariant;
        set => SetPropertyValue(nameof(OrgVariant), ref _orgVariant, value);
    }

    public LegacyWhatToDo? WhatToDo
    {
        get => _whatToDo;
        set => SetPropertyValue(nameof(WhatToDo), ref _whatToDo, value);
    }

    [Association("Org-Task")]
    public XPCollection<LegacyTask> Tasks => GetCollection<LegacyTask>(nameof(Tasks));

    [Association("Org-Contact")]
    public XPCollection<LegacyContact> Contacts => GetCollection<LegacyContact>(nameof(Contacts));

    [Association("Org-InfoTask")]
    public XPCollection<LegacyInfoTask> InfoTasks => GetCollection<LegacyInfoTask>(nameof(InfoTasks));

    [Association("Org-OrgEvent")]
    public XPCollection<LegacyOrgEvent> OrgEvents => GetCollection<LegacyOrgEvent>(nameof(OrgEvents));

    [Association("Org-ZPParusLicenseInfo")]
    public XPCollection<LegacyZPParusLicenseInfo> ParusLicenseInfo => GetCollection<LegacyZPParusLicenseInfo>(nameof(ParusLicenseInfo));

    [Association("Org-ZPParusOrder")]
    public XPCollection<LegacyZPParusOrder> ZPParusOrder => GetCollection<LegacyZPParusOrder>(nameof(ZPParusOrder));

    [Association("Org-Dogovor")]
    public XPCollection<LegacyDogovor> Dogovors => GetCollection<LegacyDogovor>(nameof(Dogovors));

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

[Persistent("set_OrgInfo1C")]
public class LegacyOrgInfo1C(Session session) : XPObject(session)
{
    public LegacyOrgInfo1C() : this(Session.DefaultSession) { }

    public string? s_1cCode;
    public string? s_1cRaion;

    [Size(254)]
    public string? s_1cName;

    [Size(500)]
    public string? s_1cFullName;

    public string? s_1cINN;
    public string? s_1cPhone;

    [Size(2000)]
    public string? s_1cOtherInfo;

    [Size(1000)]
    public string? s_1cComment;

    [Size(254)]
    public string? s_1cAddressU;

    [Size(254)]
    public string? s_1cAddressF;

    public string? s_1cCode_PC;
    public string? s_1cRaion_PC;

    [Size(254)]
    public string? s_1cName_PC;

    [Size(500)]
    public string? s_1cFullName_PC;

    public string? s_1cINN_PC;
    public string? s_1cPhone_PC;

    [Size(2000)]
    public string? s_1cOtherInfo_PC;

    [Size(1000)]
    public string? s_1cComment_PC;

    [Size(254)]
    public string? s_1cAddressU_PC;

    [Size(254)]
    public string? s_1cAddressF_PC;

    public string? s_1cCode_PG;
    public string? s_1cRaion_PG;

    [Size(254)]
    public string? s_1cName_PG;

    [Size(500)]
    public string? s_1cFullName_PG;

    public string? s_1cINN_PG;
    public string? s_1cPhone_PG;

    [Size(2000)]
    public string? s_1cOtherInfo_PG;

    [Size(1000)]
    public string? s_1cComment_PG;

    [Size(254)]
    public string? s_1cAddressU_PG;

    [Size(254)]
    public string? s_1cAddressF_PG;

    public string? s_1cCode_PC2;
    public string? s_1cRaion_PC2;

    [Size(254)]
    public string? s_1cName_PC2;

    [Size(500)]
    public string? s_1cFullName_PC2;

    public string? s_1cINN_PC2;
    public string? s_1cPhone_PC2;

    [Size(2000)]
    public string? s_1cOtherInfo_PC2;

    [Size(1000)]
    public string? s_1cComment_PC2;

    [Size(254)]
    public string? s_1cAddressU_PC2;

    [Size(254)]
    public string? s_1cAddressF_PC2;

    public LegacyOrg? Org;
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

    public string? OKPO;
    public string? OKVED;
    public string? PFR;
    public string? FSS;
    public LegacySprBank? Bank;
    public string? RSch;
    public string? LSch;

    [Size(2000)]
    public string? ECPComment;

    [Size(2000)]
    public string? ECPCommentDog;

    public string? PFRSoglNum;
    public DateTime PFRSoglDate;
    public string? RukFIO;
    public string? RukFIO_sokr;
    public string? RukFIO_rod;
    public string? RukDolgnost;
    public string? RukDolgnost_rod;
    public string? RukPhone;
    public string? RukComment;
    public string? Osnovanie_rod;

    [Size(2000)]
    public string? DopComment;

    [Size(2000)]
    public string? TechnicsComment;

    [Size(2000)]
    public string? ZakupkiComment;

    public LegacySprEnumeration? InternetSpeed;
    public LegacySprEnumeration? EDO;

    [Persistent("ZpLicNum")]
    public string? ParusLicenseNumber;

    public LegacyOrg? OrgParusLicense;
    public string? ParusLicenseFileName;
    public byte[]? ParusLicenseFileData;
    public string? ZpLicSostav;
    public int ZpNumOfBases;
    public int CountOrganizationsInDataBases;
    public int ZpNumDopPlaces;

    [Size(2000)]
    public string? ZpComment;

    public LegacyUser? ZpUser;
    public DateTime ZpDateWorkBegin;
    public DateTime ZpDateWorkEnd;
    public LegacySprEnumeration? ZpPlatform;
    public LegacySprEnumeration? ZpConfig;
    public LegacySprEnumeration? ZpRating;

    [Size(500)]
    public string? F1cComment;

    [Size(500)]
    public string? F1cCommentZ;

    [Size(500)]
    public string? F1cDorabotkiB;

    [Size(500)]
    public string? F1cDorabotkiZ;

    public LegacyUser? F1cUserB;
    public LegacyUser? F1cUserZ;
    public bool F1cBaseDogovor;
    public string? F1CRegNumB;
    public string? F1CRegNumZ;
    public LegacySprEnumeration? PlatformB;
    public LegacySprEnumeration? PlatformZ;
    public LegacySprEnumeration? ConfigB;
    public LegacySprEnumeration? ConfigZ;
    public LegacySprEnumeration? F1CVarDog;
    public DateTime F1CLicDateFrom;
    public DateTime F1CLicDateTo;
    public string? F1CLicNum;
    public LegacySprEnumeration? ITSVariant;

    [Size(500)]
    public string? F1cCommentITS;

    [Size(254)]
    public string? F1cLicSostav;

    public string? SiteAlias;
    public DateTime SiteDateDone;
    public string? SiteState;
    public int SiteIdBase;

    [Size(2000)]
    public string? SiteComment;

    public bool SiteSoprov;
    public string? SiteTemplate;

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

[Persistent("set_CategoryInfoTask")]
public class LegacyCategoryInfoTask(Session session) : XPObject(session)
{
    public LegacyCategoryInfoTask() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public string? Name;
    public string? FullName;
    public int CategoryInfoTaskVariant;

    public override string ToString() => Name ?? FullName ?? $"CategoryInfoTask#{Oid}";
}

[Persistent("set_InfoTask")]
public class LegacyInfoTask(Session session) : XPObject(session)
{
    public LegacyInfoTask() : this(Session.DefaultSession) { }

    public LegacyCategoryInfoTask? CategoryInfoTask;
    public int KolPlace;

    [Size(1000)]
    public string? Comment;

    public LegacyUser? User_update;
    public DateTime Date_update;
    public LegacySprEnumeration? OrgCreator;

    [Association("Org-InfoTask")]
    public LegacyOrg? Org;

    public override string ToString() => CategoryInfoTask?.Name ?? $"InfoTask#{Oid}";
}

[Persistent("set_CategoryOrgEvent")]
public class LegacyCategoryOrgEvent(Session session) : XPObject(session)
{
    public LegacyCategoryOrgEvent() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId;

    public int Index;
    public int ImageIndex;
    public string? Name;

    [Size(254)]
    public string? FullName;

    public int CategoryOrgEventVariant;

    public override string ToString() => Name ?? FullName ?? $"CategoryOrgEvent#{Oid}";
}

[Persistent("set_OrgEvent")]
public class LegacyOrgEvent(Session session) : XPObject(session)
{
    public LegacyOrgEvent() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId;

    public int Index;
    public int ImageIndex;
    public string? Name;

    [Size(254)]
    public string? FullName;

    [Size(2000)]
    public string? Comment;

    public DateTime Date_create;
    public DateTime Date_update;
    public DateTime DateEvent;
    public LegacyCategoryOrgEvent? CategoryOrgEvent;
    public PulsPlusSpace.set_OrgEventInfo? OrgEventInfo;

    [Association("Org-OrgEvent")]
    public LegacyOrg? Org;

    public LegacyUser? User;

    public override string ToString() => Name ?? FullName ?? $"OrgEvent#{Oid}";
}

[Persistent("set_ZPParusOrder")]
public class LegacyZPParusOrder(Session session) : XPObject(session)
{
    public LegacyZPParusOrder() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId;

    public DateTime DateCreate;
    public string? TypeOf;
    public string? Number;
    public DateTime Date;
    public string? MnemoOrg;

    [Size(254)]
    public string? MnemoName;

    public string? RegNumberClient;
    public string? Payer;
    public string? State;
    public string? TypeOfShipment;
    public decimal Discount;
    public decimal Summa;
    public DateTime InvoiceDate;
    public string? InvoiceNumber;
    public decimal CustomerAmount;

    [Association("Org-ZPParusOrder")]
    public LegacyOrg? Org;
}

[Persistent("set_ZPParusLicenseInfo")]
public class LegacyZPParusLicenseInfo(Session session) : XPObject(session)
{
    public LegacyZPParusLicenseInfo() : this(Session.DefaultSession) { }

    public DateTime DateCreate { get; set; }
    public string? Payer { get; set; }
    public string? MnemoOrg { get; set; }
    public string? RegNumberClient { get; set; }
    public string? RegNumberAbonement { get; set; }
    public DateTime DateSince { get; set; }
    public DateTime DateTo { get; set; }
    public string? Nomenclature { get; set; }

    [Size(254)]
    public string? Modification { get; set; }

    public string? Number { get; set; }
    public string? INN { get; set; }

    [Association("Org-ZPParusLicenseInfo")]
    public LegacyOrg? Org { get; set; }

    public override string ToString() => $"{Modification} - {Number}";
}

[Persistent("set_FileType")]
public class LegacyFileType(Session session) : XPObject(session)
{
    public LegacyFileType() : this(Session.DefaultSession) { }

    public int ImageIndex;
    public string? Extension;
    public string? Name;

    public override string ToString() => Name ?? $"FileType#{Oid}";
}

[Persistent("set_AttachDocumentType")]
public class LegacyAttachDocumentType(Session session) : XPObject(session)
{
    public LegacyAttachDocumentType() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public string? Name;

    [Size(254)]
    public string? FullName;

    public bool fl_def;
    public int AttachDocumentTypeVariant;

    public override string ToString() => FullName ?? Name ?? $"AttachDocumentType#{Oid}";
}

[Persistent("set_AttachDocument")]
public class LegacyAttachDocument(Session session) : XPObject(session)
{
    public LegacyAttachDocument() : this(Session.DefaultSession) { }

    public string? Name;
    public LegacyUser? User_create;
    public LegacyUser? User_update;
    public DateTime Date_create;
    public DateTime Date_update;
    public string? Number;
    public DateTime Date;
    public double Summa;

    [Size(254)]
    public string? Path;

    public string? FileName;
    public DateTime DateFrom;
    public DateTime DateTo;
    public LegacyAttachDocumentType? AttachDocumentType;
    public LegacyFileType? FileType;
    public LegacyPrivacyGroup? PrivacyGroup;
    public LegacySprEnumeration? DocumentTransport;
    public LegacySprEnumeration? DocumentState;
    public LegacySprEnumeration? PulsOrg;
    public bool FlCompleted;

    [Size(500)]
    public string? Comment;

    public LegacyOrg? Org;

    public override string ToString() => Name ?? Number ?? $"AttachDocument#{Oid}";
}

[Persistent("set_OrgDocumentStatus")]
public class LegacyOrgDocumentStatus(Session session) : XPObject(session)
{
    public LegacyOrgDocumentStatus() : this(Session.DefaultSession) { }

    public string? Kod;
    public string? Name;

    [Size(2)]
    public string? s_base2;

    public override string ToString() => Name ?? $"OrgDocumentStatus#{Oid}";
}

[Persistent("set_OrgDogovorPersonal")]
public class LegacyOrgDogovorPersonal(Session session) : XPObject(session)
{
    public LegacyOrgDogovorPersonal() : this(Session.DefaultSession) { }

    public string? Kod;
    public string? Name;

    [Size(2)]
    public string? s_base2;

    public LegacyOrg? Org;
    public LegacyOrgDocumentStatus? DogovorStatus;

    public override string ToString() => Name ?? $"OrgDogovorPersonal#{Oid}";
}

[Persistent("set_OrgRealizDocs")]
public class LegacyOrgRealizDocs(Session session) : XPObject(session)
{
    public LegacyOrgRealizDocs() : this(Session.DefaultSession) { }

    public string? Number;
    public DateTime Date;
    public double Sumdoc;
    public bool FlDone;
    public string? EDOStatus;
    public LegacyOrg? Org;
    public LegacyOrgDocumentStatus? RealizDocStatus;
    public LegacyOrgDogovorPersonal? OrgDogovorPersonal;

    public override string ToString() => Number ?? $"OrgRealizDocs#{Oid}";
}

[Persistent("set_Dogovor")]
public class LegacyDogovor(Session session) : XPObject(session)
{
    public LegacyDogovor() : this(Session.DefaultSession) { }

    public string? Kod1C;
    public string? Name;
    public LegacyUser? User_create;
    public LegacyUser? User_update;
    public DateTime Date_create;
    public DateTime Date_update;
    public string? Number;
    public DateTime Date;
    public DateTime C1Date;
    public double Summa;
    public string? FileName;

    [Size(254)]
    public string? Path;

    public DateTime DateFrom;
    public DateTime DateTo;
    public LegacyFileType? FileType;
    public LegacySprEnumeration? DocumentTransport;
    public LegacySprEnumeration? DocumentState;
    public LegacySprEnumeration? PulsOrg;

    [Size(500)]
    public string? Comment;

    [Association("Org-Dogovor")]
    public LegacyOrg? Org;

    public int FlTo1C;
    public string? NumKontrakt;
    public bool FlProlongation;

    [Persistent("FlParus10Tornадо")]
    public bool FlParus10Tornado;

    public bool Fl1CHourSopr;
    public bool FlLgotITS;
    public int NumFZ;

    public override string ToString() => Name ?? Number ?? $"Dogovor#{Oid}";
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

[Persistent("set_SprBank")]
public class LegacySprBank(Session session) : XPObject(session)
{
    public LegacySprBank() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId;

    public string? BIK;
    public string? Gorod;
    public string? OKPO;
    public string? KSch;

    [Size(254)]
    public string? Name;

    [Persistent("fl_def")]
    public bool FlDefault;

    public override string ToString() => Name ?? BIK ?? $"Bank#{Oid}";
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
