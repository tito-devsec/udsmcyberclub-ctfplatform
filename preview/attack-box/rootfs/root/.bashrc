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

# the prompt, in the club's blue and gold: the box's address, then udsmcyberrange@<player>
__cr_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
__cr_player=$(printf '%s' "${CR_PLAYER:-player}" | tr -cd 'A-Za-z0-9_.-' | cut -c1-32)
__b='\[\e[38;2;96;150;240m\]'
__g='\[\e[38;2;245;184;46m\]'
__w='\[\e[97m\]'
__c='\[\e[38;2;125;211;252m\]'
PS1="${__b}┌─[${__g}attack-box${__b}]─[${__w}${__cr_ip:-no network}${__b}]─[${__g}udsmcyberrange${__w}@${__c}${__cr_player:-player}${__b}]─[${__w}\w${__b}]\n${__b}└──╼ ${__g}\\$\[\e[0m\] "
unset __b __g __w __c

# a few words when a terminal opens; the first terminal of a box shows the welcome first
if shopt -q login_shell; then
  mkdir /run/cyberrange-welcomed 2> /dev/null && /usr/local/share/cyberrange/welcome
  printf '\n  \e[1;38;2;245;184;46mUDSM CyberRange\e[0m \e[38;2;96;150;240m·\e[0m attack box\n\n'
  if getent hosts target > /dev/null 2>&1; then
    printf '  Your lab machine answers as \e[1mtarget\e[0m. Type \e[1mtarget\e[0m to see its open ports.\n'
  else
    printf '  No lab machine is attached yet. Start one on the lab page and it answers as \e[1mtarget\e[0m.\n'
  fi
  printf '  Files sent from the Files window land in \e[1m~/uploads\e[0m.\n'
  printf '  There is no internet here. Type \e[1mtools\e[0m to see what is installed.\n\n'
fi
