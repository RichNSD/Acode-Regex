
(?# This is a comment)

(?# This is a capture group)
([Cc]ontents?[,: ]?)

(?# Prompt String)
^(?<user>[\w.+-]+)@(?<host>(?:[a-z\d-]+\.)+[a-z]{2,})$


(?i)\b(?:https?|ftp)://[^\s/$.?#].[^\s]*\b
(?x)
  (?<year> \d{4} )
  -(?<month>0[1-9]|1[0-2])
  -(?<day>\d{2})
  (?(<month>)\k<year>|none)(*SKIP)
  [[:alpha:][:digit:]\]]++ \x{1F600} \Qliteral .* text\E