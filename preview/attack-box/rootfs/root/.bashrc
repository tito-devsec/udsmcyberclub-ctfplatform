# The shell of the UDSM CyberRange attack box.
case $- in *i*) ;; *) return ;; esac

HISTCONTROL=ignoreboth
HISTSIZE=2000
shopt -s histappend checkwinsize
[ -f /usr/share/bash-completion/bash_completion ] && . /usr/share/bash-completion/bash_completion

alias ls='ls --color=auto'
alias ll='ls -alF --color=auto'
alias grep='grep --color=auto'
alias ip='ip -color=auto'
export EDITOR=nano

# whose box this is: written down when the box starts, so that it survives sudo and su
__cr_player=$(cat /etc/cyberrange/player 2> /dev/null || printf '%s' "${CR_PLAYER:-player}")
__cr_player=$(printf '%s' "$__cr_player" | tr -cd 'A-Za-z0-9_.-' | cut -c1-32)

# the prompt, drawn the way Kali draws its own:
#   ┌──(udsmcyberrange@<player>)-[~]
#   └─#
__l='\[\e[38;2;54;182;160m\]'
__u='\[\e[1;38;2;59;142;234m\]'
__d='\[\e[1;97m\]'
__0='\[\e[0m\]'
PS1="${__l}┌──(${__u}udsmcyberrange@${__cr_player:-player}${__0}${__l})-[${__d}\w${__0}${__l}]\n${__l}└─${__u}"'\$'"${__0} "
unset __l __u __d __0

# every new terminal opens on the club's welcome
shopt -q login_shell && /usr/local/share/cyberrange/welcome
