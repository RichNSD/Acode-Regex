^(?<user>[\w.+-]+)@(?<host>(?:[a-z\d-]+\.)+[a-z]{2,})$
(?i)\b(?:https?|ftp)://[^\s/$.?#].[^\s]*\b
(?x)
  (?<year> \d{4} )            # year
  -(?<month>0[1-9]|1[0-2])    # month
  -(?<day>\d{2})              # day
  (?(<month>)\k<year>|none)(*SKIP)(?#an inline comment)
  [[:alpha:][:digit:]\]]++ \x{1F600} \Qliteral .* text\E
*invalid-leading-quantifier) unmatched-paren \c
