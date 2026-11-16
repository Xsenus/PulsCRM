using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class WebPushCryptoTests
{
    // Пример из RFC 8291, приложение A.
    private const string Plaintext = "When I grow up, I want to be a watermelon";
    private const string AsPrivate = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
    private const string UaPublic = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
    private const string Salt = "DGv6ra1nlYgDCS1FRnbzlw";
    private const string AuthSecret = "BTBZMqHH6r4Tts7J_aSIgg";
    private const string ExpectedBody =
        "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

    [Fact]
    public void EncryptMatchesTheRfc8291Example()
    {
        var body = WebPushCrypto.Encrypt(
            Encoding.UTF8.GetBytes(Plaintext),
            UaPublic,
            AuthSecret,
            WebPushCrypto.FromBase64Url(AsPrivate),
            WebPushCrypto.FromBase64Url(Salt));

        Assert.Equal(ExpectedBody, WebPushCrypto.ToBase64Url(body));
    }

    [Fact]
    public void RandomEncryptionUsesFreshSaltAndServerKey()
    {
        var first = WebPushCrypto.Encrypt(Encoding.UTF8.GetBytes(Plaintext), UaPublic, AuthSecret);
        var second = WebPushCrypto.Encrypt(Encoding.UTF8.GetBytes(Plaintext), UaPublic, AuthSecret);
        Assert.NotEqual(first[..16], second[..16]);
        Assert.Equal(4096u, System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(first.AsSpan(16, 4)));
        Assert.Equal(65, first[20]);
    }

    [Fact]
    public void RejectsMalformedSubscriptionKeys()
    {
        Assert.Throws<ArgumentException>(() => WebPushCrypto.Encrypt([1], "AAAA", AuthSecret));
        Assert.Throws<ArgumentException>(() => WebPushCrypto.Encrypt([1], UaPublic, "AAAA"));
    }

    [Fact]
    public void VapidHeaderIsAValidEs256TokenForTheEndpointOrigin()
    {
        var keys = WebPushVapidKeys.Generate();
        var now = DateTimeOffset.FromUnixTimeSeconds(1_800_000_000);
        var header = WebPushCrypto.CreateVapidAuthorization("https://fcm.googleapis.com/fcm/send/abc:def", keys, "mailto:admin@example.test", now);

        Assert.StartsWith("vapid t=", header);
        Assert.EndsWith($", k={keys.PublicKey}", header);
        var token = header["vapid t=".Length..header.IndexOf(',')];
        var parts = token.Split('.');
        Assert.Equal(3, parts.Length);

        using var claims = JsonDocument.Parse(WebPushCrypto.FromBase64Url(parts[1]));
        Assert.Equal("https://fcm.googleapis.com", claims.RootElement.GetProperty("aud").GetString());
        Assert.Equal("mailto:admin@example.test", claims.RootElement.GetProperty("sub").GetString());
        Assert.Equal(now.AddHours(12).ToUnixTimeSeconds(), claims.RootElement.GetProperty("exp").GetInt64());

        var publicKey = WebPushCrypto.FromBase64Url(keys.PublicKey);
        using var verifier = ECDsa.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256, Q = WebPushCrypto.DecodePublicKey(publicKey) });
        Assert.True(verifier.VerifyData(
            Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}"),
            WebPushCrypto.FromBase64Url(parts[2]),
            HashAlgorithmName.SHA256,
            DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
    }
}
