// Where the attack box's Firefox sends what it opens (policies.json points Firefox here).
//
// The student's lab machine ("target") and their box ("box") go through Burp Suite while it runs
// (127.0.0.1:8080, see cyberrange-burp), so that Burp sees, and can hold, what Firefox sends
// them; while Burp is not running, Firefox goes straight to them. "burp" is Burp's own page, with
// the certificate it signs with. Every website goes through the club's proxy (egress), the only
// way out of here, which refuses addresses that are not on the internet.
function FindProxyForURL(url, host) {
  var name = host.toLowerCase()
  if (name === 'target' || name === 'box') return 'PROXY 127.0.0.1:8080; DIRECT'
  if (name === 'burp') return 'PROXY 127.0.0.1:8080'
  if (name === 'localhost' || name === '127.0.0.1') return 'DIRECT'
  return 'PROXY egress:3128'
}
