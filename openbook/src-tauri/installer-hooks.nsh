; Désinstallation : remet Windows exactement comme avant le « Mode Googlebook »
; (thème, couleur d'accent, fond d'écran, barre des tâches).
!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --restore'
!macroend
