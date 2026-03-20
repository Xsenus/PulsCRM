using DevExpress.Xpo;

namespace PulsPlusSpace;

[Persistent("set_OrgEventInfo")]
public class set_OrgEventInfo(Session session) : XPObject(session)
{
    public set_OrgEventInfo() : this(Session.DefaultSession) { }

    [Persistent("g_id")]
    public string? GId;

    public string? Name;
    public DateTime DateFrom;
    public DateTime DateTo;
    public bool FlProcess;
    public PulsNext.Domain.Legacy.LegacyOrgEvent? OrgEvent;
}

[Persistent("set_OrgEventInfo_Zvonok")]
public class set_OrgEventInfo_Zvonok(Session session) : set_OrgEventInfo(session)
{
    public set_OrgEventInfo_Zvonok() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public PulsNext.Domain.Legacy.LegacyTask? Task;
}

[Persistent("set_OrgEventInfo_Journal")]
public class set_OrgEventInfo_Journal(Session session) : set_OrgEventInfo(session)
{
    public set_OrgEventInfo_Journal() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public bool Completed;
}

[Persistent("set_OrgEventInfo_Coming")]
public class set_OrgEventInfo_Coming(Session session) : set_OrgEventInfo(session)
{
    public set_OrgEventInfo_Coming() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public bool Completed;
}

[Persistent("set_OrgEventInfo_Turnout")]
public class set_OrgEventInfo_Turnout(Session session) : set_OrgEventInfo(session)
{
    public set_OrgEventInfo_Turnout() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public bool Completed;
}

[Persistent("set_OrgEventInfo_Licenz")]
public class set_OrgEventInfo_Licenz(Session session) : set_OrgEventInfo(session)
{
    public set_OrgEventInfo_Licenz() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public bool Completed;
    public string? LicKey;
    public PulsNext.Domain.Legacy.LegacyTask? Task;
    public byte[]? File;

    [Size(254)]
    public string? FileName;

    public double LicSumma;

    [Size(254)]
    public string? LicSummaComment;
}

[Persistent("set_OrgEventInfo_RingJur")]
public class set_OrgEventInfo_RingJur(Session session) : set_OrgEventInfo(session)
{
    public set_OrgEventInfo_RingJur() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public bool Completed;
    public PulsNext.Domain.Legacy.LegacyTask? Task;
}

[Persistent("set_OrgEventInfo_Oplata")]
public class set_OrgEventInfo_Oplata(Session session) : set_OrgEventInfo(session)
{
    public set_OrgEventInfo_Oplata() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public bool Completed;
    public PulsNext.Domain.Legacy.LegacyTask? Task;
}

[Persistent("set_OrgEventInfo_Note")]
public class set_OrgEventInfo_Note(Session session) : set_OrgEventInfo(session)
{
    public set_OrgEventInfo_Note() : this(Session.DefaultSession) { }

    public int Index;
    public int ImageIndex;
    public PulsNext.Domain.Legacy.LegacyTask? Task;
}
